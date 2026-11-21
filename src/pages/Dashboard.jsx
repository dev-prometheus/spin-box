import { useState, useEffect, useRef } from 'react';
import { PackageIcon, TicketIcon, WalletIcon, ArrowClockwiseIcon, MinusCircleIcon, TrophyIcon } from '@phosphor-icons/react';
import { useCurrency } from '@/context/CurrencyContext';
import { supabase } from '@services/supabaseClient';
import { DELIVERY_MINIMUM_USD, walletPrizeUsd } from '@services/fulfillment';
import { formatUsdAmount } from '@services/currency';
import SpinWheel from '@components/SpinWheel';
import TemuInspector from '@components/TemuInspector';
import OrderTracker from '@components/OrderTracker';
import UgcProofCard from '@components/UgcProofCard';
import ReferralTree from '@components/ReferralTree';
import FulfillmentModal from '@components/FulfillmentModal';
import '@styles/pages/Dashboard.css';

const MIN_STAKE_USD = 1;
const starterItem = { title: 'Welcome Starter Item', priceUsd: 2 };

export default function Dashboard({
  user,
  profile,
  onBalanceChange,
  onReferralChange,
  onOpenDeposit
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [spinStatus, setSpinStatus] = useState(null);
  const [activityMessage, setActivityMessage] = useState('');
  const [roundBusy, setRoundBusy] = useState(false);
  const [checkingItem, setCheckingItem] = useState(false);
  const [roundUncertain, setRoundUncertain] = useState(false);
  const [retryRound, setRetryRound] = useState(null);
  const [roundState, setRoundState] = useState('loading');
  const [stakeInput, setStakeInput] = useState('');
  const [entry, setEntry] = useState('item');
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const quotePending = useRef(false);
  const requestId = useRef(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { formatMoney, currency, hasRate } = useCurrency();
  const balance = Number(profile.account_credits);
  const variants = selectedProduct?.variants ?? [];
  const variant = variants.find((option) => option.id === variantId);
  const total = variant ? Math.round(variant.priceUsd * 100) * quantity / 100 : null;
  const previewPrice = variants.length ? Math.min(...variants.map((option) => option.priceUsd)) : null;
  const priceVaries = variants.some((option) => option.priceUsd !== previewPrice);

  const quoteMoney = (value) => currency !== 'USD' && hasRate
    ? `${formatMoney(value)} (${formatUsdAmount(value, 'USD', null)})`
    : formatMoney(value);
  const target = retryRound ? {
    title: retryRound.product_title,
    priceUsd: retryRound.retail_value_usd,
    imageUrl: retryRound.image_url,
  } : selectedProduct ?? starterItem;
  const reviewedTotal = retryRound || !selectedProduct ? Number(target.priceUsd) : total;
  const reviewedQuantity = retryRound ? (retryRound.order_selection?.quantity ?? 1) : (variant ? quantity : 1);
  const reviewedOptions = retryRound ? retryRound.order_selection?.options : variant?.options;
  const optionSummary = Object.entries(reviewedOptions ?? {}).map(([label, value]) => `${label}: ${value}`).join(' / ');
  const stake = retryRound ? Number(retryRound.stake_usd) : (selectedProduct || entry === 'budget') ? Number(stakeInput) : MIN_STAKE_USD;
  const currentQuote = quote?.entry === entry && (entry === 'budget' ? quote.input === stake : quote.input === total) ? quote : null;
  const validStake = retryRound || (!selectedProduct && entry === 'item') || (
    /^\d+(?:\.\d{1,2})?$/.test(stakeInput) && total != null && currentQuote != null && (entry === 'budget'
      ? currentQuote.ranges.some(({ min, max }) => total >= min && total <= max)
      : stake >= currentQuote.min && stake <= currentQuote.max)
  );
  const needsDeposit = !retryRound && validStake && stake > balance;
  const amountCharged = validStake ? quoteMoney(stake) : 'Enter stake';
  const roundBlocked = roundState !== 'ready' || (!roundUncertain && (!validStake || needsDeposit));
  const pickLocked = roundBusy || roundUncertain || Boolean(retryRound) || roundState !== 'ready' || quoteBusy;
  const [wins, setWins] = useState([]);
  const [activeWinModal, setActiveWinModal] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [totalTeam, setTotalTeam] = useState(null);
  const [winsState, setWinsState] = useState('loading');
  const [teamState, setTeamState] = useState('loading');

  function refreshBenefits() {
    setWinsState('loading');
    setTeamState('loading');
    setRefreshTick((tick) => tick + 1);
  }

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    let ignore = false;

    async function loadDashboardData() {
      const [spinsRes, teamRes] = await Promise.all([
        supabase
          .from('game_spins')
          .select('*')
          .eq('user_id', userId)
          .eq('outcome', 'WIN')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.rpc('get_referral_network_stats')
      ]);

      if (!ignore) {
        if (spinsRes.data) setWins(spinsRes.data);
        setWinsState(spinsRes.error ? 'error' : 'ready');
        setTeamState(teamRes.data?.total_team != null ? 'ready' : 'error');
        if (teamRes.data?.total_team !== undefined) {
          setTotalTeam(Number(teamRes.data.total_team));
        }
      }
    }

    loadDashboardData().catch(() => {
      if (!ignore) {
        setWinsState('error');
        setTeamState('error');
      }
    });
    return () => {
      ignore = true;
    };
  }, [userId, refreshTick]);

  useEffect(() => {
    if (!userId) return undefined;
    let ignore = false;
    async function loadRound() {
      try {
        const { data, error } = await supabase.from('paid_rounds').select('*')
          .eq('user_id', userId).eq('status', 'RETRY').maybeSingle();
        if (ignore) return;
        if (error) throw error;
        setRetryRound(data);
        setRoundState('ready');
      } catch {
        if (!ignore) setRoundState('error');
      }
    }
    void loadRound();
    return () => { ignore = true; };
  }, [userId]);

  async function requestQuote() {
    if (quotePending.current || pickLocked || checkingItem) return;
    const input = entry === 'budget' ? Number(stakeInput) : total;
    if (input == null || !Number.isFinite(input) || (entry === 'budget' &&
        (!/^\d+(?:\.\d{1,2})?$/.test(stakeInput) || input < 1))) {
      setQuoteError(entry === 'budget' ? 'Enter a stake of at least $1 USD, with up to two decimal places.' : 'Choose a verified item option and quantity.');
      return;
    }
    quotePending.current = true;
    setQuoteBusy(true);
    setQuoteError('');
    setQuote(null);
    try {
      const { data, error } = await supabase.rpc('get_paid_quote', {
        p_stake_usd: entry === 'budget' ? input : null,
        p_order_usd: entry === 'item' ? input : null,
      });
      if (error || !data?.id || (entry === 'budget' && !Array.isArray(data.ranges))) {
        setQuoteError(error?.code === 'P0001' ? error.message : 'We couldn’t get your quote. Try again.');
        return;
      }
      setQuote({ ...data, entry, input });
      if (entry === 'item') setStakeInput(Number(data.min).toFixed(2));
    } catch {
      setQuoteError('We couldn’t get your quote. Try again.');
    } finally {
      quotePending.current = false;
      setQuoteBusy(false);
    }
  }

  async function handleRequestServerSpin() {
    setSpinStatus(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const { data, error, status } = await supabase.rpc('play_paid_round', {
        p_request_id: requestId.current,
        p_round_id: retryRound?.id ?? null,
        p_product_id: selectedProduct?.id ?? null,
        p_expected_price_usd: total ?? Number(target.priceUsd),
        p_variant_id: variant?.id ?? null,
        p_quantity: variant ? quantity : 1,
        p_stake_usd: stake,
        p_quote_id: currentQuote?.id ?? null,
      });
      if (!error && data?.round && data?.spin_record) return data;
      if (status === 400 && error?.code === 'P0001') {
        requestId.current = null;
        setRoundUncertain(false);
        if (error.message.startsWith('Round changed.')) setRoundState('error');
        if (error.message.startsWith('Your quote changed.')) setQuote(null);
        setSpinStatus({ title: 'Round unavailable', text: error.message });
        return null;
      }
    } catch {
      // Reusing the request ID recovers a response lost after the database committed.
    }
    setRoundUncertain(true);
    setSpinStatus({
      title: 'Round result unavailable',
      text: 'Check the result again to recover this request without a second charge.',
    });
    return null;
  }

  function handleDashboardSpinComplete(result) {
    requestId.current = null;
    setRoundUncertain(false);
    if (result.account_credits != null && Number.isFinite(Number(result.account_credits))) {
      onBalanceChange(result.account_credits);
    }
    setQuote(null);
    setRetryRound(result.round.status === 'RETRY' ? result.round : null);
    const charge = Number(result.round.stake_usd);
    if (result.outcome === 'TRY_AGAIN') {
      setSpinStatus({ outcome: 'retry', title: 'Try again', text: 'Your stake is held for this item. Spin again at no extra cost.' });
      return;
    }
    if (result.outcome === 'LOSE') {
      setSpinStatus({ outcome: 'lose', title: 'You didn’t win', text: `You lost your ${formatMoney(charge)} stake.` });
      return;
    }
    const wonRecord = { ...result.spin_record, image_url: result.round.image_url };
    setWins((previous) => [wonRecord, ...previous.filter((win) => win.id !== wonRecord.id)]);
    setActiveWinModal(wonRecord);
    setSpinStatus({ outcome: 'win', title: 'You won the item', text: result.round.product_title, winId: wonRecord.id });
  }

  function handleFulfillmentComplete(result) {
    setActiveWinModal(null);
    setWins((previous) => previous.map((win) => {
      if (win.id !== result.spinId) return win;
      return result.type === 'LIQUIDATED'
        ? { ...win, fulfillment_choice: 'LIQUIDATED', liquidation_cash_usd: result.payoutUsd, shipping_status: 'NOT_APPLICABLE' }
        : { ...win, fulfillment_choice: 'SHIPPED', shipping_status: 'PENDING', product_attributes: result.attributes };
    }));
    setRefreshTick((tick) => tick + 1);
    if (result.type === 'LIQUIDATED') {
      if (result.newBalance !== undefined) onBalanceChange(result.newBalance);
      setActivityMessage(`${formatMoney(result.payoutUsd)} added to your wallet.`);
    } else if (result.type === 'SHIPPED') {
      setActivityMessage('Delivery details saved. Check your order below.');
    }
  }

  async function handleConvertReferralCredits() {
    const { data, error, status } = await supabase.rpc('convert_referral_to_credits');
    if (error && status >= 400 && status < 500 && status !== 408) {
      return { error: 'The transfer was declined. Check your available commission and try again.' };
    }
    if (error || data?.account_credits == null || data?.converted_usd == null) {
      throw new Error('Transfer not confirmed');
    }
    onBalanceChange(data.account_credits);
    onReferralChange?.(0);
    return { amount: Number(data.converted_usd) };
  }

  return (
    <main className="tsb-play-page" id="main-content">
      <div className="tsb-play-wrap">
        <header className="play-heading">
          <div>
            <p className="play-kicker">TemuSpinBox / Play</p>
            <h1>{retryRound ? 'Your retry is ready.' : 'Pick an item to play for.'}</h1>
            <p>{retryRound ? 'Your item and stake are held for this spin.' : 'Start with your budget or the item you want to win.'}</p>
          </div>
          <button type="button" className="play-secondary" onClick={onOpenDeposit}>
            <WalletIcon size={18} /> Wallet <strong>{formatMoney(balance)}</strong>
          </button>
        </header>

        <div className={`play-board${retryRound ? ' play-board-retry' : ''}`}>
          <section className="play-pick" aria-labelledby="play-pick-heading">
            <h2 id="play-pick-heading">{retryRound ? 'Your reserved item' : 'Choose your item'}</h2>
            {!retryRound && (
              <div className="play-quote-entry">
                <div className="play-entry-modes" role="group" aria-label="How to start">
                  <button type="button" className="play-secondary" aria-pressed={entry === 'budget'} disabled={pickLocked || checkingItem}
                    onClick={() => { setEntry('budget'); setQuoteError(''); }}>I have a budget</button>
                  <button type="button" className="play-secondary" aria-pressed={entry === 'item'} disabled={pickLocked || checkingItem}
                    onClick={() => { setEntry('item'); setQuoteError(''); }}>I have a Temu item</button>
                </div>
                {entry === 'budget' && <div className="play-stake">
                  <label htmlFor="budget-stake">Your stake in USD</label>
                  <input id="budget-stake" type="text" inputMode="decimal" value={stakeInput} disabled={pickLocked || checkingItem}
                    onChange={(event) => { setStakeInput(event.target.value); setQuoteError(''); }} />
                  <button type="button" className="play-secondary" disabled={pickLocked || checkingItem} onClick={requestQuote}>
                    {quoteBusy ? 'Getting your range…' : 'Show my item range'}
                  </button>
                  {currentQuote && <div className="play-quote-reveal" role="status">
                    <strong>Eligible item prices</strong>
                    {currentQuote.ranges.map(({ min, max }) => <p key={min}>{min === max ? quoteMoney(min) : `${quoteMoney(min)} to ${quoteMoney(max)}`}</p>)}
                  </div>}
                </div>}
                {quoteError && <p role="alert" className="play-inspector-error">{quoteError}</p>}
              </div>
            )}
            {!retryRound && (entry === 'item' || currentQuote) && <TemuInspector
              userDepositBalance={balance}
              disabled={pickLocked}
              onLoadingChange={setCheckingItem}
              onSelectProduct={(product) => {
                setSelectedProduct(product);
                const only = product.variants?.length === 1 ? product.variants[0] : null;
                setVariantId(only?.id ?? '');
                setQuantity(1);
                setQuoteError('');
                setSpinStatus(null);
              }}
            />}
            <div className="play-product">
              <div className="play-product-image">
                {target.imageUrl && <img key={target.imageUrl} src={target.imageUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
                <PackageIcon size={42} weight="light" />
              </div>
              <div>
                <p className="play-kicker">{selectedProduct || retryRound ? 'Item value' : 'Ready to play'}</p>
                <h3>{target.title}</h3>
                <p className="play-product-price">{!retryRound && selectedProduct && !variant && priceVaries && 'From '}{quoteMoney(variant && !retryRound ? variant.priceUsd : !retryRound && previewPrice != null ? previewPrice : Number(target.priceUsd))}</p>
                {selectedProduct && !retryRound && (
                  <button type="button" className="play-link" disabled={pickLocked || checkingItem} onClick={() => setSelectedProduct(null)}>
                    Use starter item
                  </button>
                )}
              </div>
            </div>
            {selectedProduct && !retryRound && variants.length > 0 && (
              <div className="play-stake">
                {variants.length > 1 && <>
                  <label htmlFor="play-variant">Choose a product option</label>
                  <select id="play-variant" value={variantId} disabled={pickLocked || checkingItem} onChange={(event) => {
                    const next = variants.find((option) => option.id === event.target.value);
                    setVariantId(next?.id ?? '');
                    setQuantity(1);
                    setQuoteError('');
                  }}>
                    <option value="">Select a size, color or style</option>
                    {variants.map((option) => <option key={option.id} value={option.id}>
                      {Object.entries(option.options).map(([name, value]) => `${name}: ${value}`).join(' / ')} · {quoteMoney(option.priceUsd)}
                    </option>)}
                  </select>
                </>}
                {variant && <>
                  {variants.length === 1 && Object.entries(variant.options).map(([name, value]) => <p key={name}>{name}: {value}</p>)}
                  <label htmlFor="play-quantity">Quantity</label>
                  <select id="play-quantity" value={quantity} disabled={pickLocked || checkingItem} onChange={(event) => {
                    const next = Number(event.target.value);
                    setQuantity(next);
                    setQuoteError('');
                  }}>
                    {Array.from({ length: variant.maxQuantity }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                  </select>
                </>}
              </div>
            )}
            <div className="play-ticket">
              <TicketIcon size={22} weight="regular" />
              <div>
                <h3>Round review</h3>
                <dl>
                  <div><dt>Order value</dt><dd>{selectedProduct && !retryRound ? (total != null ? quoteMoney(total) : previewPrice != null ? `${priceVaries ? 'From ' : ''}${quoteMoney(previewPrice)}` : 'Unavailable') : quoteMoney(Number(target.priceUsd))}</dd></div>
                  {reviewedTotal != null && <>
                    <div><dt>Quantity</dt><dd>{reviewedQuantity}</dd></div>
                    {optionSummary && <div><dt>Item options</dt><dd>{optionSummary}</dd></div>}
                    <div><dt>Cash option if you win</dt><dd>{quoteMoney(walletPrizeUsd(reviewedTotal))}</dd></div>
                    <div><dt>Delivery</dt><dd>{reviewedTotal >= DELIVERY_MINIMUM_USD ? 'Available for eligible orders' : `Available from ${quoteMoney(DELIVERY_MINIMUM_USD)}`}</dd></div>
                  </>}
                  <div><dt>{retryRound ? 'Reserved stake' : 'Stake'}</dt><dd>{amountCharged}</dd></div>
                </dl>
                {variant && !retryRound && entry === 'item' && !currentQuote && (
                  <button type="button" className="play-secondary" disabled={pickLocked || checkingItem} onClick={requestQuote}>
                    {quoteBusy ? 'Getting your quote…' : 'Show my stake range'}
                  </button>
                )}
                {variant && !retryRound && entry === 'item' && currentQuote && (
                  <div className="play-stake">
                    <p className="play-quote-reveal" role="status">Stake range: {quoteMoney(currentQuote.min)}{currentQuote.max !== currentQuote.min && ` to ${quoteMoney(currentQuote.max)}`}</p>
                    <label htmlFor="play-stake">Enter stake in USD</label>
                    <input id="play-stake" type="text" inputMode="decimal" placeholder="1.00"
                      disabled={pickLocked || checkingItem} value={stakeInput}
                      onChange={(event) => setStakeInput(event.target.value)} />
                  </div>
                )}
                <p>{retryRound
                  ? 'Your next spin uses the stake already held for this item.'
                  : 'Win or lose, the stake is spent. If you land on Try again, you can spin for this item at no extra cost.'}</p>
                {selectedProduct && !retryRound && !variants.length && <p className="play-ticket-note">We couldn’t verify an option and its available quantity. Try another item or check this link again.</p>}
                {variant && currentQuote && !validStake && <p className="play-ticket-note">Choose an item and stake within the quoted range.</p>}
                {needsDeposit && <p className="play-ticket-note">Add funds to play for this item.</p>}
              </div>
            </div>
          </section>

          <section className="play-stage" aria-labelledby="play-stage-heading">
            <h2 id="play-stage-heading">{retryRound ? 'Spin again' : 'The wheel'}</h2>
            {retryRound && <p className="play-stage-note">No additional stake required</p>}
            <SpinWheel
              onRequestServerSpin={handleRequestServerSpin}
              onSpinResult={handleDashboardSpinComplete}
              onBusyChange={setRoundBusy}
              buttonText={roundUncertain ? 'Check round result' : retryRound ? 'Spin again' : checkingItem ? 'Checking item…' : validStake ? `Stake ${amountCharged} and spin` : !variant ? 'Choose a verified option' : !currentQuote ? 'Get your quote first' : 'Review your quote range'}
              disabled={Boolean(roundBlocked || checkingItem)}
              onAddFunds={needsDeposit && !roundUncertain && !checkingItem && !roundBusy && roundState === 'ready' ? onOpenDeposit : undefined}
            />
            {roundState === 'loading' && <p role="status">Checking for an open round…</p>}
            {roundState === 'error' && (
              <button type="button" className="play-secondary play-add" onClick={() => window.location.reload()}>Reload to check your round</button>
            )}
            <div className="play-result" data-outcome={spinStatus?.outcome}>
              {spinStatus && (
                <>
                  <div role="status" aria-atomic="true">
                    {spinStatus.outcome === 'win' && <TrophyIcon size={24} aria-hidden="true" />}
                    {spinStatus.outcome === 'lose' && <MinusCircleIcon size={24} aria-hidden="true" />}
                    {spinStatus.outcome === 'retry' && <ArrowClockwiseIcon size={24} aria-hidden="true" />}
                    <strong>{spinStatus.title}</strong>
                    {spinStatus.text && <p>{spinStatus.text}</p>}
                  </div>
                  {wins.some((win) => win.id === spinStatus.winId && !win.fulfillment_choice) && (
                    <button type="button" className="play-secondary" onClick={() => setActiveWinModal(wins.find((win) => win.id === spinStatus.winId))}>Claim prize</button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        <div className="play-account">
          {activityMessage && <div className="status-banner" role="status">{activityMessage}</div>}
          <div className="play-orders">
            <OrderTracker wins={wins} status={winsState} onRefresh={refreshBenefits} onClaimUnclaimed={setActiveWinModal} />
          </div>

          <UgcProofCard key={`rewards-${userId}`} userId={userId} wins={wins} winsState={winsState} onRefreshWins={refreshBenefits} />

          <ReferralTree
            key={`referrals-${userId}`}
            userId={userId}
            referralBalance={profile.referral_balance}
            totalTeam={totalTeam}
            teamState={teamState}
            onRefreshTeam={refreshBenefits}
            onOpenWallet={onOpenDeposit}
            onConvertCredits={handleConvertReferralCredits}
          />

        </div>
      </div>

      <FulfillmentModal
        winRecord={activeWinModal}
        onClose={(refreshOrders) => {
          setActiveWinModal(null);
          if (refreshOrders) setRefreshTick((tick) => tick + 1);
        }}
        onFulfillmentSuccess={handleFulfillmentComplete}
      />
    </main>
  );
}