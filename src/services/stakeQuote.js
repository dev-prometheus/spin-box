// Match the paid-round tiers using cents. The next tier may be cheaper than
// the lower tier would require, so stop at the first tier that can cover it.
export function minimumStakeUsd(orderUsd) {
  const cents = Math.round(orderUsd * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  if (cents <= 499 * 2) return Math.max(100, Math.ceil(cents / 2)) / 100;
  if (cents <= 10100 * 5 - 5) return Math.max(500, Math.ceil(cents / 5)) / 100;
  return Math.max(10100, Math.ceil(cents / 7)) / 100;
}
