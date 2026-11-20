# Product rules and decision discipline

## Purpose

Use this guide to distinguish intended behavior from existing code and historical examples. This is the initial decision baseline, not a claim that the financial engine is correct.

## Confirmed intent

- Build a real product wagering platform, mobile first with a purposeful desktop experience.
- Show balances and stakes as money in a consistent selected currency. Do not call the displayed balance credits.
- Separate wallet funding, available balance and the amount committed to a round. A deposit is not automatically the stake for every round.
- Paid outcomes: WIN ITEM, LOSE and TRY AGAIN. A loss consumes the full committed stake. A retry preserves that same stake without a second payment. A win grants the selected product, with delivery or eligible cash liquidation.
- Example only: stake approximately NGN 45,000 to target a product worth NGN 203,000. Do not hardcode these amounts or infer a universal multiplier.
- Proof rewards scale. Example only: approximately NGN 40,000 for verified delivery proof and NGN 20,000 for liquidation proof, intended for replay. USD 5 and USD 2.50 were illustrative, not fixed rewards.

## Open decisions: do not invent

Exact stake calculation and tier basis; win stake settlement; retry cancellation, expiry and product-change rules; reward percentage/basis, rounding, caps and withdrawal restrictions; final odds; FX source/timing; minimum deposits/withdrawals; welcome grant; shipping threshold and referral conditions.

Existing SQL uses USD 1 spin cost, fixed 5/2.50 rewards, 22/28/50 outcome weights, 50% liquidation, USD 33 shipping gate and 10/5/4/3/2 referral percentages. Label these existing behavior pending reconciliation. The current cost and reward constants directly conflict with user clarification. Do not advertise obsolete deposit bonuses.

## Financial implementation procedure

1. State the confirmed rule and identify unresolved inputs.
2. Derive an authoritative server quote with product/variant, value, currency, stake and expiry. Do not trust browser-submitted retail values.
3. Model round states explicitly: quoted, reserved, retry available, won/lost, fulfilled. Record settlement once and preserve recoverable state after disconnects.
4. Separate available cash, reserved stake, referrals and restricted promotional value. Document transfers and withdrawal eligibility.
5. Record monetary entries with source, reason, correlation ID and idempotency key. Use database decimal arithmetic; format currency at the UI boundary.
6. Enforce ownership, role access, positive finite values and atomic transitions in backend/database code. Inspect actual RPC permissions; SECURITY DEFINER does not imply backend-only access.
7. Test duplicate requests, concurrent tabs, delayed responses, retries, repeat claims, deposit replay and withdrawal rejection refunds.

Document a decision as: topic, status (confirmed/proposed/open), rule/formula, source, example, rounding and affected screens/functions. Preserve unknowns rather than filling them with plausible numbers. Keep normal UI usable while dependent financial actions remain unavailable in a prototype.
