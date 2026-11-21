# TemuSpinBox paid spin rules

**Agreed on 21 November 2026.** Use this as the reference for the new paid-spin rules. These rules supersede the earlier 2×, 5× and 7× tiers in planning and examples. Implementation and deployment are pending.

## Deposit and stake

- A deposit funds the player's wallet. The stake is the amount the player chooses to commit to one round. Depositing money does not automatically stake it.
- Use USD as the base currency. Show the local-currency equivalent where available. A local-currency example does not set a fixed stake or tier threshold.

## Before the spin

1. The player enters a stake.
2. The system randomly draws the maximum product-value multiplier. Show the player the resulting eligibility range before they spin.
3. The player chooses the exact Temu product and, where applicable, its variant and quantity. The verified total order value must be at least **3× the stake** and at most **the stake × the multiplier drawn**.
4. Show the exact selection, total value, and stake before confirmation. Lock those details for the round.

| Product value band | Minimum eligible value | Possible drawn maximum |
|---|---:|---:|
| Up to and including $10 | 3× stake | 3× to 4× stake |
| Above $10 | 3× stake | 3× to 6× stake |

The drawn maximum is a ceiling. The chosen item's verified value determines the prize and cash payout. The wheel separately draws the paid-round outcome.

## After the spin

| Outcome | What happens |
|---|---|
| **Win** | Spend the stake once. The player wins the exact selection and can request delivery if eligible or take **50% of the locked total order value** as money in their TemuSpinBox wallet. |
| **Lose** | The full stake is spent and the round ends. |
| **Try again** | Keep the same item, variant, quantity, locked value, and reserved stake. The next spin uses that stake with no second debit. |
| **Order cannot be fulfilled in full** | Pay **50% of the locked total order value** into the withdrawable wallet, including when only part of the chosen quantity is available. |

Cash-out credits the TemuSpinBox wallet. An external crypto withdrawal is a separate request. The cash win does not return the original stake separately.

## Worked example

A **$3 stake** and a **4× draw** give a multiplier-based product range of **$9 to $12**. For an eligible selection:

| Locked product value | Wallet payout | Profit after the $3 stake |
|---:|---:|---:|
| $9.00 | $4.50 | $1.50 |
| $10.00 | $5.00 | $2.00 |
| $11.00 | $5.50 | $2.50 |
| $12.00 | $6.00 | $3.00 |

Under this rule, the gross cash value of a win is at least **1.5× the stake**, before any external withdrawal fees. A loss still costs the full stake.

## Decisions still open

- **Band selection.** Decide how the system picks the up-to-$10 or above-$10 band before the exact product is chosen, including how to handle ranges that cross $10.
- **Random draw.** Decide which multiplier values can be drawn, whether fractional multipliers are allowed, the probability of each value, and what happens if the player refreshes, edits the stake, or requests another quote.
- **Wheel odds.** Confirm the probabilities of Win, Lose, and Try again separately. The multiplier ranges do not specify those odds.
- **Quote settlement.** Confirm cent rounding at eligibility boundaries and for 50% payouts, as well as quote expiry and the rules for changed prices or stock before confirmation.
