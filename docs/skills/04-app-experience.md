# Responsive application and operational screens

## Compose around tasks

Provide Play, Wallet, Activity, Orders, Rewards, Referrals and Account/Help destinations. Adapt navigation to screen size; labels must remain understandable. Preserve the active task across navigation and refresh. Keep admin controls in a separate workspace.

## Player screen

Desktop: use a purposeful content grid, typically around 1120–1280px maximum width if content supports it. Place a substantial product preview and stake ticket beside the wheel/result. Support activity without overwhelming the main task. Tablet needs its own considered arrangement. Mobile: product, stake and outcome information remain readable; the wheel and primary action fit without horizontal overflow. Sticky actions must not obscure fields, errors or focus.

Show product/variant, verified value, currency, available money, committed stake and eligible cash alternative. Do not hide the risk behind a generic Spin button. Example CTA: Stake {amount} — spin for this item. Confirm the monetary action on ordinary activation, not pointer-down.

## Wallet

Separate Deposit and Withdraw. Select asset/network intentionally; show network names and warnings in plain terms. Include deposit address, copy feedback and QR when implemented. Show transaction history and confirmation states, minimums, fee and net received, pending withdrawals and expected timing. Distinguish available funds from reserved or restricted amounts. Never expose secrets or mnemonic data.

## Orders, rewards and referrals

Orders: full history, fulfillment choices, tracking, delivery confirmation and support for missing/damaged items. Rewards: eligibility, calculated amount, proof input and pending/approved/rejected status with reasons. Referrals: link, genuinely defined network counts, commission history and eligible balance. Do not label depositors as the full registered network.

## Admin

Use wide, filterable and paginated tables on desktop with readable compact rows; use practical mobile layouts. Prioritize pending payouts, shipping requests, proof reviews and operational errors. Show currency and status explicitly. Require role checks on every backend operation. Trace financial mutations and report failures honestly; a successful HTTP handler is not evidence every database write succeeded.

## Screen-state contract

For every screen document entry points, primary action, data ownership, loading, empty, success, validation error, network error, permission denial, stale data and recovery. Consider wallet disconnects/session expiry, duplicate clicks, multiple tabs, back navigation and refresh during a pending operation.

Use mobile sheets and desktop dialogs/panels only where appropriate. Support focus trapping, Escape where safe, focus return, scroll containment and mobile keyboard resizing. Persistent financial state must not depend on a modal remaining open.
