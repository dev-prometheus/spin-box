# TemuSpinBox build checklist

Work from top to bottom. Check each build item after implementation and each verification item after it passes in the target environment.

## 1. Bright landing page and welcome wheel

- [x] Apply a bright cream and vivid orange palette to the landing page and welcome modal.
- [x] Open a dismissible “Try your luck” modal on arrival for eligible guests. Give the wheel and spin button priority on mobile.
- [x] Give a win its own Reveal Fold animation and a clear reward claim button.
- [x] Generate and record the guest’s outcome on the server. Win, Lose, and Try again must all be possible on the first spin.
- [x] Let Try again continue the same visit. End the current attempt on Lose and allow a fresh attempt on a return visit.
- [x] Define and document the welcome odds and what counts as a return visit before enabling the campaign. Each outcome has a one-in-three chance. A guest can try again on a return visit at least 30 minutes after a loss.
- [ ] Verify all three outcomes, dismissal, mobile layout, reduced motion, and the difference between a refresh and an eligible return visit.

## 2. Email claim and password sign-in

- [x] Let visitors play before signing in. After a win, carry the recorded result into email verification.
- [x] Credit the verified account once. Repeating the claim must never credit a second reward.
- [x] Offer password setup after email verification and email/password sign-in on return visits.
- [x] Keep email recovery available for forgotten passwords and let existing code-only users set a password.
- [ ] Verify new and existing account flows, password recovery, and repeat claims.

## 3. Product options and stake quote

- [ ] Check whether the Temu lookup provides reliable variant IDs, prices, availability, and quantity limits. Test a single-option item and an item with multiple sizes or colors. Fixture tests passed. Confirm the configured Apify actor returns SKU IDs, price, stock, and availability on live links in staging.
- [x] Show the product photo, price, and minimum stake as soon as a verified link loads. Use “From” when pricing varies by option.
- [x] Let players choose the available color, size, and quantity. Recalculate the order value and minimum stake when the selection changes.
- [x] Preselect the calculated minimum stake, allow a higher stake, and enforce the minimum on the server. Show local currency and USD together and explain what a higher stake changes under the paid rules.
- [x] Block the spin if the exact selection or quantity cannot be verified. Ask the player to review a fresh quote if the price or availability changes before confirmation.
- [ ] Verify one versus three units, variant price changes, unavailable options, and a stake entered below the minimum.

## 4. Paid spin and fulfillment

- [x] Lock the exact variant, quantity, total order value, and stake when the player confirms the spin.
- [x] On Win, record the exact winning order and spend the stake. On Lose, spend the full stake. On Try again, preserve the same order and stake across reloads with no second debit.
- [x] Show the winning selection in Orders and in the admin fulfillment queue.
- [x] Pay **50% of the locked total order value** into the withdrawable wallet if the player chooses cash or if TemuSpinBox cannot fulfill the entire exact order. Apply the same rule if only part of the quantity is available.
- [x] Prevent duplicate payouts and prevent the same win from being both shipped and paid out. Show the payout and its reason in Orders.
- [ ] Verify retries, duplicate requests, exact variant fulfillment, partial stock, and both routes to the 50% payout.

## 5. Staging and release verification

- [ ] Apply the database migrations and confirm the matching frontend and backend versions on staging.
- [ ] Run the full journey from guest spin and email claim through product selection, paid spin, fulfillment, and withdrawal.
- [ ] Test a small deposit and withdrawal for each enabled crypto option. Confirm that repeated scans or requests do not move money twice.
- [ ] Verify deposit catch-up after downtime and confirm an unpaid withdrawal refund restores the original balance once.
- [ ] Record the test evidence before opening the updated flow to players.
