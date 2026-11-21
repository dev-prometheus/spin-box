export const DELIVERY_MINIMUM_USD = 33;

export function walletPrizeUsd(orderValueUsd) {
  return Math.ceil(Math.round(orderValueUsd * 100) / 2) / 100;
}
