# Spinbox — Product Specification and Implementation Review

Version: 0.1 — reconciled review, 31 October 2026. Status: specification draft; unresolved economic decisions are explicitly marked. No application or database changes have been made.

## 1. Authority and scope

Latest explicit user instructions take precedence over historical generated documents and current implementation. The uploaded SQL is evidence of statements the user reports executing, not an introspection of the live database. Failed statements, separate execution batches, and grants configured elsewhere may change actual live state.

Sources reviewed: spinbox.zip; Pasted text.txt (801 lines of PostgreSQL); data_structures_context-temu.txt; full-architecture-temu.txt; three gemini-code text exports; price-checker specification; crypto payment research notes; color specification; three supplied interface screenshots; current conversation corrections. Historical documents mix MySQL prototypes, PostgreSQL implementation, obsolete deposit bonuses, and illustrative amounts. They must not be merged as equally authoritative requirements. Payment-provider research claims have not been independently verified and are not adopted as platform capabilities.

## 2. Confirmed product intent

Spinbox is a real product wagering platform. The comparison with long/short prediction platforms describes the clarity and seriousness of the interaction, not a requirement to implement market charts or price prediction.

Users fund a wallet, select a verified Temu product, and commit a monetary stake. The three paid outcomes are WIN ITEM, LOSE, and TRY AGAIN. Display money in the selected currency; do not describe the available balance as credits.

| Outcome | Confirmed meaning |
| --- | --- |
| Win item | Win the selected product; choose qualifying delivery or cash liquidation. |
| Lose | Lose the entire stake committed to that round. |
| Try again | Retry using the same stake without another payment. |

The user's example is a ₦45,000 stake targeting an approximately ₦203,000 product. These are illustrative monetary values, not global fixed stake or prize amounts. Wallet funding and a round's stake must be distinct concepts. The example does not establish that every round consumes the entire wallet.

The win must settle the stake exactly once; whether any stake is returned separately on a win needs explicit confirmation. A retry must preserve the round and its stake, rather than silently permit reuse for a different product or withdrawal. The exact reservation and cancellation rules are pending.

## 3. Economic rules and unresolved formulas

### Stake and product selection

The current 2×/5×/7× balance tiers are existing implementation behavior, not a settled replacement for a stake formula. Define whether stake is chosen by the user or quoted from the product price, which multiplier applies, its basis, rounding, currency handling, and quote expiry before implementation.

Do not derive a universal multiplier from ₦203,000 / ₦45,000. Approximate examples do not establish exact ratios.

### Liquidation and shipping

Existing documents and SQL use 50% of recorded retail value for liquidation and a USD 33 physical-shipping threshold. The latest discussion retains delivery versus liquidation but has not explicitly reconfirmed every historical threshold. Carry these as existing rules pending confirmation, rather than silently remove or expand them.

Liquidation first credits an internal wallet. That is distinct from blockchain withdrawal; the current backend does not broadcast payouts.

### Social-proof rewards

Confirmed intent: rewards scale with the relevant round; USD 5 and USD 2.50 were examples, not fixed global rewards. For the user's example, verified delivery proof earns approximately ₦40,000 for replay, and liquidation proof earns approximately ₦20,000 for replay. Cash-proof reward is half the delivery-proof reward in that example.

Pending: exact percentage, calculation basis (stake, product value, or another amount), rounding, caps, eligibility, expiry, replay restriction, and whether reward funds can be withdrawn. Do not label these rewards as withdrawable cash until confirmed. Do not infer a 20%/10% rule from rounded examples.

### Other existing constants

Current SQL uses USD 2 minimum deposit, USD 5 minimum withdrawal, USD 1 welcome grant, and 10%/5%/4%/3%/2% deposit referral commissions. They are implemented constants, subject to reconciliation. Historical deposit bonuses of 5%/10%/20% are absent from current deposit processing and must not be advertised as active.

## 4. Current architecture

React/Vite frontend; Express backend; Supabase Auth/PostgreSQL/RPC/realtime; Resend OTP email; Apify and Puppeteer product extraction; deterministic HD deposit addresses; blockchain polling plus a custom secret-protected webhook; manual fulfillment and payout administration.

Funds arrive at platform-derived addresses controlled through a platform master mnemonic. This is platform-controlled custody relative to users; the historical label “non-custodial” is misleading for this implementation. No wallet sweeping, gas funding, transaction signing, or automated payout worker appears in the uploaded source.

USD is the current internal accounting unit; local display uses hardcoded FX, including ₦1,550/USD. Production design needs one consistent currency preference and an explicit conversion policy, quote timestamp, and rounding method.

## 5. SQL and source findings

### 5.1 Critical: round cost contradicts intended stake

execute_paid_spin fixes v_spin_cost at 1.00. WIN and LOSE deduct USD 1; TRY_AGAIN deducts nothing. Product eligibility depends on total account_credits, while the prize value and title are supplied by the browser. There is no stake parameter, round reservation, retry linkage, or authoritative product lookup. product_id is not populated by this RPC.

Consequences: the actual loss is not the user's intended stake, and a caller can submit an arbitrary product title/value within the balance cap. Nonpositive values are not rejected explicitly. Fixing the frontend label alone cannot repair this economic mismatch.

The SQL roll uses 22% WIN, 28% TRY_AGAIN, and 50% LOSE. These probabilities are implementation facts, not confirmed business rules. The six equal visible wheel sectors do not represent those weights; the paid RPC never selects the welcome-credit sector.

### 5.2 Critical: deposit RPC authorization is not locked down in supplied SQL

process_confirmed_deposit is SECURITY DEFINER, accepts a user ID and arbitrary transaction hash/amount, and does not authenticate a backend role or verify a blockchain transaction. No REVOKE EXECUTE or restricted GRANT is supplied. Under ordinary PostgreSQL default function privileges, PUBLIC receives execute access; actual deployed privileges need inspection. RLS policies do not substitute for function authorization.

Required: restrict backend-only functions to the intended service role; verify actual ACLs and default privileges; validate finite positive amounts and supported assets; verify chain events before crediting. Do not assume the “Called by Backend Watcher” comment enforces access.

### 5.3 OTP migration conflict can block login

The first email_otps definition has code_hash TEXT NOT NULL and is_used. Later CREATE TABLE IF NOT EXISTS proposes otp_hash, consumed, and referrer_id, but does not alter the existing definition. Final ALTER statements add the new columns without removing or relaxing code_hash NOT NULL. Backend inserts otp_hash and omits code_hash, which can fail on the resulting original table.

The second index statement reuses idx_email_otps_lookup with IF NOT EXISTS; it therefore does not replace the original index with the intended consumed/created_at index. Verify actual columns, constraints, and indexes before a corrective migration.

OTP verification has no visible failed-attempt throttle. Read-then-mark-used is not an atomic consume operation, and its update error is ignored. The old is_used/code_hash fields and new consumed/otp_hash fields need one coherent migration.

### 5.4 Rewards are fixed and share the cash ledger

submit_ugc_proof assigns 5.00 or 2.50 regardless of stake or product value. Admin approval routes this through process_confirmed_deposit as SYSTEM/CREDITS. That creates a deposit record and fires the deposit referral trigger, potentially awarding commissions on promotional rewards and inflating reported deposit volume.

All welcome funds, real deposits, liquidation proceeds, and approved rewards accumulate in account_credits. Withdrawal can debit this shared balance; no source-specific promotional restriction exists. Rename labels only after defining separate monetary categories and transfer rules.

The reward RPC does not require DELIVERED status for unboxing proof or a completed external withdrawal for cash-out proof. Its nullable fulfillment comparison uses !=, which can evaluate to NULL and fail to reject an unclaimed record. Explicit ownership, WIN outcome, non-null fulfillment, delivery/payout eligibility, and duplicate controls must be enforced in the database.

### 5.5 Existing strengths and remaining accounting gaps

Liquidation and shipping functions lock the owned spin and prevent a second fulfillment choice. Withdrawals lock the user row before debiting. Deposit transaction hashes are unique; racing duplicate inserts should roll back rather than duplicate a credit, though the precheck is not a clean conflict-handling strategy.

Missing constraints include NOT NULL and nonnegative checks on balances, positive amount checks, controlled statuses, valid chain/asset combinations, and explicit NULL rejection at financial RPC boundaries. Withdrawal rounding, address length alone, and unrestricted asset strings are insufficient validation. Rejection/refund workflow is absent from supplied routes. Historical commission statuses are not updated by referral withdrawals, so detail records can diverge from aggregate balance meaning.

SECURITY DEFINER functions should receive explicit execution grants and fixed safe search paths. Referrer cycles are not prevented; a five-step loop limits depth but can still pay the same participant repeatedly if a cycle is introduced.

### 5.6 Deposit and pricing operations

Watcher scans only the latest 100 address records, recent short transaction windows, and no durable cursor. Older addresses and transactions can be missed. setInterval can overlap long cycles. Repeated pricing of an old below-minimum transaction can change eligibility when exchange prices change. Tron confirmation checks need a clearly implemented policy. Ethereum watcher implements USDT, not native ETH deposits.

The webhook trusts its normalized payload after a shared-secret check; it does not independently check chain, asset, destination event, amount, and finality. Shared-secret authentication alone is not chain verification.

Current Temu hostname validation uses substring matching, which admits unrelated hostnames containing temu.com. Redirects and scraper network access need strict destination validation. Scraper sets inStock true rather than establishing stock reliably. The lowest visible price heuristic can select an unrelated price, and cache identity does not preserve market/variant pricing. Six-hour cached data should not be described as newly verified live data on every view.

Frontend and SQL tier boundaries disagree: frontend uses >=101 for 7× while SQL uses >100; fractional balances also expose the 4.99/5 boundary difference. Selected-product eligibility becomes stale after a balance change.

### 5.7 Administration and runtime limits

Several admin routes ignore returned database errors. Reward approval, reward funding, moderation status, and audit insertion are separate operations; they need consistent atomic transitions. Shipping and payout completion also need status and input checks. Marking a withdrawal complete records a supplied hash without validating the actual payment.

Network count is distinct depositors who generated commissions, not all registered downline members. Winning history loads only ten records and mixes missing image/currency fields with transient frontend metadata. Realtime updates exist for user balances, not full order progression.

Migration statements are not safely rerunnable as one consolidated script. Existing source and SQL require inspection on a disposable database before corrective migrations; this review has not run the SQL or contacted production.

## 6. Visual and UX specification

### Design direction

Keep the supplied direction: solid dark surfaces, restrained orange primary actions, green positive monetary states, crisp borders, readable sans-serif typography, no decorative blur or ambient glows. Color alone must not communicate state. Do not interpret professional platform design as a requirement for trading charts.

### Landing page

Create a distinct responsive public page with deliberate typography and composition:

1. Clear navigation, brand, how-it-works link, and sign-in/get-started action.
2. Strong hero explaining product selection and monetary stake, supported by a large product-led app preview.
3. Short three-step explanation: choose item, review stake, receive outcome.
4. Explicit outcome explanation including full-stake loss and stake-preserving retry.
5. Delivery versus liquidation section with eligibility clearly stated.
6. Proof-reward and referral summaries driven by confirmed formulas.
7. FAQ, support, rules, privacy, and affiliation disclosure.

Use real supplied content or clearly marked demonstrations. Do not fabricate winner activity, testimonials, delivery counts, treasury backing, or instant external payout claims. Welcome interaction, if retained, must be distinguished from a paid round and must not imply random chances when its sequence is scripted.

### Application layouts

Desktop: proposed 1120–1280px content area; clear primary navigation; product selection/preview and stake ticket beside the wheel/result area; supporting history and summaries arranged purposefully. Avoid a fixed 480px stack on wide screens.

Mobile: readable product preview, explicit stake ticket, responsive wheel, thumb-friendly action, and compact navigation to Wallet, Activity, Rewards, and Referrals. Supporting functions should not bury the main action in one endless page. Tablets must receive an intentional intermediate layout.

Primary round ticket must show product title/image, verified product value and currency, stake, available balance, possible liquidation value where applicable, and the loss/retry explanation before committing funds. A proposed CTA is “Stake ₦45,000 — spin for this item”; displayed values must come from an authoritative quote.

Paid wheel: only the three confirmed outcome types, with no USD 1 welcome-credit sector. Win opens clear fulfillment choices; loss shows exact stake lost; retry shows the same active stake with no second charge. Disclose actual probabilities once confirmed; never infer probability from sector size.

Wallet: distinguish available money, reserved stake, referral earnings, and any restricted replay rewards. Show transaction histories and pending withdrawals. Use consistent currency formatting across all screens.

Orders/rewards: show actual delivery and payout stages; calculate reward amounts dynamically; show pending/approved/rejected states with clear eligibility and reasons.

Admin: practical desktop tables and usable mobile cards, with filters, pagination, loading/error states, and traceable financial transitions.

### Acceptance checks

Verify layouts at approximately 360, 390, 768, 1024, and 1440px. No horizontal overflow, clipped amounts, tiny product imagery, inconsistent controls, or hidden focus indicators. Touch targets should generally be at least 44px. Respect reduced motion; provide keyboard and dialog focus behavior; keep an accessible textual outcome outside canvas. Test loading, empty, failed verification, insufficient funds, active retry, pending claim, and payout failure states.

## 7. Decisions needed before implementation

1. Exact stake quote formula, tier basis/boundaries, and whether user chooses stake.
2. Win settlement: stake consumed, returned, or otherwise included in prize accounting.
3. Retry reservation, cancellation, expiry, and product-change rules.
4. UGC percentage/basis, rounding, caps, proof eligibility, and replay/withdrawal restrictions.
5. Confirmation of welcome grant, shipping threshold, minimum deposit/withdrawal, referral rules, and final probabilities.
6. FX source and timing for deposits, stake quotes, product values, rewards, and withdrawals.

These open decisions are not permission gates for reading or preparing design work; they prevent encoding invented economics.

## 8. Recommended implementation order

First inspect actual schema and function permissions, then repair financial authorization and schema compatibility. Confirm economic formulas and define authoritative round quotes, stake reservation, retry transitions, and monetary ledger categories. Implement and test financial transitions before enabling real stakes. In parallel within the project workflow, design the landing and app layouts from this specification; connect them to confirmed server behavior. Finally validate scrapers, deposit indexing, fulfillment, payout operations, and responsive accessibility.

No application code has been edited and no migration has been executed as part of this document.
