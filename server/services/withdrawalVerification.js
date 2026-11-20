import bs58 from 'bs58';
import { address as bitcoinAddress, networks } from 'bitcoinjs-lib';
import { createHash } from 'node:crypto';
import { getAddress, id } from 'ethers';

const assets = {
  'BTC:BTC': { decimals: 8 },
  'ETH:USDT': { decimals: 6, token: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  'TRX:TRX': { decimals: 6 },
  'TRX:USDT': { decimals: 6, token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  'SOL:SOL': { decimals: 9 },
  'SOL:USDC': { decimals: 6, token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
};
const transferTopic = id('Transfer(address,address,uint256)').slice(2);
const tronBase = 'https://api.trongrid.io/walletsolidity';
const bitcoinBase = 'https://mempool.space/api';
const solanaMainnet = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const solanaUrl = () => process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function requireMainnet(chain) {
  if (chain === 'ETH' && await rpc(process.env.ETHEREUM_RPC_URL, 'eth_chainId') !== '0x1') {
    throw new PayoutError('The Ethereum provider must be on mainnet.');
  }
  if (chain === 'SOL' && await rpc(solanaUrl(), 'getGenesisHash') !== solanaMainnet) {
    throw new PayoutError('The Solana provider must be on mainnet.');
  }
}

export class PayoutError extends Error {}

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) throw new PayoutError('Transaction not found on the selected network.');
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response;
}

async function post(url, body, headers) {
  const response = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function rpc(url, method, params = []) {
  const data = await post(url, { jsonrpc: '2.0', id: 1, method, params });
  if (data.error || data.result === undefined) throw new Error('Chain RPC did not return a result');
  return data.result;
}

function tronHex(address) {
  const decoded = Buffer.from(bs58.decode(address));
  const payload = decoded.subarray(0, 21);
  const hash = (bytes) => createHash('sha256').update(bytes).digest();
  if (decoded.length !== 25 || payload[0] !== 0x41 || !hash(hash(payload)).subarray(0, 4).equals(decoded.subarray(21))) {
    throw new Error('Invalid TRON address');
  }
  return payload.toString('hex').slice(2);
}

function payoutConfig(row) {
  const asset = assets[`${row.chain}:${row.asset}`];
  if (!asset) throw new PayoutError('This withdrawal network or asset is unsupported.');
  const sender = process.env[`PAYOUT_${row.chain}_ADDRESS`]?.trim();
  if (!sender || (row.chain === 'ETH' && !process.env.ETHEREUM_RPC_URL)) {
    throw new PayoutError('Configure the treasury address and chain provider before preparing a payout.');
  }
  try {
    if (row.chain === 'ETH') {
      getAddress(sender);
      getAddress(row.destination_address);
    } else if (row.chain === 'TRX') {
      tronHex(sender);
      tronHex(row.destination_address);
    } else if (row.chain === 'SOL') {
      if ([sender, row.destination_address].some((address) => bs58.decode(address).length !== 32)) throw new Error();
    } else {
      bitcoinAddress.toOutputScript(sender, networks.bitcoin);
      bitcoinAddress.toOutputScript(row.destination_address, networks.bitcoin);
    }
    const caseInsensitive = row.chain === 'ETH' || (row.chain === 'BTC' && /^bc1/i.test(sender));
    if (caseInsensitive ? sender.toLowerCase() === row.destination_address.toLowerCase() : sender === row.destination_address) throw new Error();
  } catch {
    throw new PayoutError('The treasury or destination address is invalid for this payout.');
  }
  return { ...asset, sender: row.chain === 'BTC' && /^bc1/i.test(sender) ? sender.toLowerCase() : sender };
}

function decimalFraction(value) {
  const text = String(value);
  if (!/^\d{1,16}(?:\.\d{1,16})?$/.test(text)) throw new Error('Invalid quote value');
  const [whole, fraction = ''] = text.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}

export async function quoteWithdrawal(row) {
  const { decimals } = payoutConfig(row);
  await requireMainnet(row.chain);
  let price = '1';
  if (row.asset !== 'USDT' && row.asset !== 'USDC') {
    const response = await request(`https://api.binance.com/api/v3/ticker/price?symbol=${row.asset}USDT`);
    const ticker = await response.json();
    if (ticker.symbol !== `${row.asset}USDT`) throw new Error('Unexpected ticker');
    price = ticker.price;
  }
  const [amount, amountScale] = decimalFraction(row.amount_usd);
  const [rate, rateScale] = decimalFraction(price);
  if (amount <= 0n || rate <= 0n) throw new Error('Invalid payout quote');
  const numerator = amount * rateScale * 10n ** BigInt(decimals);
  const denominator = rate * amountScale;
  return { units: ((numerator + denominator - 1n) / denominator).toString(), decimals };
}

export function normalizePayoutHash(chain, value) {
  if (chain === 'SOL') {
    try {
      if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && bs58.decode(value).length === 64) return value;
    } catch { /* Invalid signature. */ }
  } else {
    const pattern = chain === 'ETH' ? /^0x[0-9a-f]{64}$/i : /^[0-9a-f]{64}$/i;
    if (pattern.test(value)) return value.toLowerCase();
  }
  throw new PayoutError('Enter a valid transaction ID for this network.');
}

function logAmount(logs, token, sender, destination) {
  let total = 0n;
  for (const log of logs ?? []) {
    const hex = (value) => String(value ?? '').toLowerCase().replace(/^0x/, '');
    if (hex(log.address) === token && hex(log.topics?.[0]) === transferTopic &&
        hex(log.topics?.[1]) === sender.padStart(64, '0') &&
        hex(log.topics?.[2]) === destination.padStart(64, '0') && /^[a-f0-9]{64}$/.test(hex(log.data))) {
      total += BigInt(`0x${hex(log.data)}`);
    }
  }
  return total;
}

async function ethereumTransfer(row, hash, { sender, token }) {
  const url = process.env.ETHEREUM_RPC_URL;
  const [receipt, finalized] = await Promise.all([
    rpc(url, 'eth_getTransactionReceipt', [hash]),
    rpc(url, 'eth_getBlockByNumber', ['finalized', false]),
  ]);
  if (!receipt || !finalized || BigInt(receipt.blockNumber) > BigInt(finalized.number)) {
    throw new PayoutError('Wait for Ethereum finality before verifying this payout.');
  }
  if (receipt.status !== '0x1' || receipt.transactionHash?.toLowerCase() !== hash) {
    throw new PayoutError('Ethereum transaction failed or could not be matched.');
  }
  const block = await rpc(url, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
  if (!block || block.hash !== receipt.blockHash) {
    throw new PayoutError('The Ethereum transaction is outside the finalized chain.');
  }
  return {
    time: Number(BigInt(block.timestamp)),
    units: logAmount(receipt.logs, token.slice(2), sender.toLowerCase().slice(2), row.destination_address.toLowerCase().slice(2)),
  };
}

async function tronTransfer(row, hash, { sender, token }) {
  const headers = process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {};
  const info = await post(`${tronBase}/gettransactioninfobyid`, { value: hash }, headers);
  if (info.id !== hash || !info.blockTimeStamp) throw new PayoutError('Wait for TRON confirmation before verifying this payout.');
  if (info.result === 'FAILED') throw new PayoutError('The TRON transaction failed.');
  const source = tronHex(sender);
  const destination = tronHex(row.destination_address);
  let units = 0n;
  if (token) {
    if (info.receipt?.result === 'SUCCESS') units = logAmount(info.log, tronHex(token), source, destination);
  } else {
    const tx = await post(`${tronBase}/gettransactionbyid`, { value: hash }, headers);
    const contract = tx.raw_data?.contract?.[0];
    const transfer = contract?.parameter?.value;
    if (tx.txID === hash && tx.ret?.[0]?.contractRet === 'SUCCESS' && contract?.type === 'TransferContract' &&
        transfer.owner_address === `41${source}` && transfer.to_address === `41${destination}`) {
      units = BigInt(transfer.amount);
    }
  }
  return { time: info.blockTimeStamp / 1000, units };
}

async function bitcoinTransfer(row, hash, { sender }) {
  const [tx, height] = await Promise.all([
    request(`${bitcoinBase}/tx/${hash}`).then((response) => response.json()),
    request(`${bitcoinBase}/blocks/tip/height`).then((response) => response.text()),
  ]);
  if (tx.txid !== hash || !tx.status?.confirmed || !Number.isSafeInteger(tx.status.block_height) ||
      !/^\d+$/.test(height) || Number(height) - tx.status.block_height < 1) {
    throw new PayoutError('Wait for two Bitcoin confirmations before verifying this payout.');
  }
  const fromTreasury = tx.vin?.length && tx.vin.every((input) => input.prevout?.scriptpubkey_address === sender);
  const destination = /^bc1/i.test(row.destination_address) ? row.destination_address.toLowerCase() : row.destination_address;
  const units = fromTreasury ? tx.vout.reduce((total, output) => output.scriptpubkey_address === destination
    ? total + BigInt(output.value) : total, 0n) : 0n;
  return { time: tx.status.block_time, units };
}

async function solanaTransfer(row, hash, { sender, token }) {
  const tx = await rpc(solanaUrl(), 'getTransaction', [hash, { commitment: 'finalized', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
  if (!tx) throw new PayoutError('Wait for Solana finality before verifying this payout.');
  if (tx.meta?.err !== null || tx.transaction?.signatures?.[0] !== hash) throw new PayoutError('The Solana transaction failed.');
  const keys = tx.transaction.message.accountKeys;
  if (!keys.some((key) => key.pubkey === sender && key.signer)) return { time: tx.blockTime, units: 0n };

  let units = 0n;
  if (token) {
    // Direct SPL transfers from the configured treasury to the requested wallet owner.
    const balances = tx.meta.postTokenBalances ?? [];
    const preBalances = tx.meta.preTokenBalances ?? [];
    const ownerDelta = (owner) => {
      const sum = (items) => items.filter((entry) => entry.owner === owner && entry.mint === token)
        .reduce((total, entry) => total + BigInt(entry.uiTokenAmount.amount), 0n);
      return sum(balances) - sum(preBalances);
    };
    for (const instruction of tx.transaction.message.instructions) {
      const { type, info } = instruction.parsed ?? {};
      if (instruction.program !== 'spl-token' || !['transfer', 'transferChecked'].includes(type) ||
          info?.authority !== sender || (info.mint && info.mint !== token)) continue;
      const source = preBalances.find((entry) => keys[entry.accountIndex]?.pubkey === info.source);
      const destination = balances.find((entry) => keys[entry.accountIndex]?.pubkey === info.destination);
      if (source?.owner === sender && source.mint === token &&
          destination?.owner === row.destination_address && destination.mint === token) {
        units += BigInt(info.amount ?? info.tokenAmount.amount);
      }
    }
    if (ownerDelta(row.destination_address) !== units || ownerDelta(sender) !== -units) units = 0n;
  } else {
    for (const instruction of tx.transaction.message.instructions) {
      const { type, info } = instruction.parsed ?? {};
      if (instruction.program === 'system' && type === 'transfer' && info?.source === sender && info.destination === row.destination_address) {
        units += BigInt(info.lamports);
      }
    }
  }
  return { time: tx.blockTime, units };
}

const verify = { ETH: ethereumTransfer, TRX: tronTransfer, BTC: bitcoinTransfer, SOL: solanaTransfer };

export async function verifyWithdrawal(row, hash) {
  const config = payoutConfig(row);
  if (row.payout_decimals !== config.decimals || !/^[1-9]\d*$/.test(row.payout_units ?? '')) {
    throw new PayoutError('Prepare the exact payout amount before verification.');
  }
  await requireMainnet(row.chain);
  const { time, units } = await verify[row.chain](row, hash, config);
  const quotedAt = Date.parse(row.payout_quoted_at);
  if (!Number.isFinite(time) || !Number.isFinite(quotedAt) || time < Math.floor(quotedAt / 1000)) {
    throw new PayoutError('The transaction predates the prepared payout.');
  }
  if (units !== BigInt(row.payout_units)) {
    throw new PayoutError('The treasury, destination, asset or amount does not match the prepared payout.');
  }
}
