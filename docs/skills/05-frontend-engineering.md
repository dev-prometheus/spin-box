# Frontend engineering workflow

## Scope

Apply relevant React composition and performance principles to the existing React/Vite SPA. Do not copy Next.js server-component, next/dynamic or server-action recipes into this stack. Inspect actual dependency versions before using newer APIs. Do not replace working APIs merely to match a reference's stylistic preference.

## Work sequence

1. Inspect the current route/component, styles, API/RPC contract and related state.
2. Read product rules for money-sensitive behavior and the selected visual tokens.
3. Implement a coherent vertical slice with loading/error/recovery states.
4. Run checks appropriate to the change, inspect mobile/desktop rendering and report limitations.

## Architecture

Separate page composition, reusable controls, data access and currency formatting. Use explicit variants or composed children instead of proliferating boolean props. Lift shared state only as far as necessary. Derive simple values during render; avoid effects that merely copy derived state. Clean up subscriptions, observers, event listeners, animation frames and audio resources.

Parallelize independent reads. Avoid unnecessary fetch waterfalls and deduplicate repeated requests where needed. Guard stale async results when product, account or route changes. Lazy-load substantial secondary screens where useful; measure bundle impact before introducing a large UI/motion dependency.

Use refs for per-frame wheel animation values, not React state updates every frame. Keep financial outcome computation server-owned. Frontend disabled controls improve interaction but cannot enforce idempotency or authorization.

## Data and CSS

Use centralized currency formatting and explicit conversion metadata. Do not use browser floating-point calculations as the authoritative money ledger. Never store secrets in VITE variables, localStorage, source or shared files. Distinguish expired auth from empty data.

Extend semantic CSS tokens rather than adding arbitrary colors per screen. Use grid/flex with min-width: 0 and content-driven breakpoints. Reserve image dimensions, choose appropriate resolutions and provide fallbacks. Keep heavy decorative assets off the critical path.

## Verification

Run existing build/lint checks and focused tests for changed behavior. Financial transitions require concurrency/idempotency checks at the enforcing layer. Pure visual changes usually need rendered checks rather than tests mirroring CSS. Do not claim tests passed unless executed. Do not deploy or execute production migrations merely to preview design.
