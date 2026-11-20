# TemuSpinBox landing refinement : Version 2

## Apply

This is a cumulative update containing the previous landing implementation plus this refinement. Back up your project, then extract into its root (beside package.json), merge src/ and public/ and replace matching files. Keep your environment files. There are no new npm dependencies. Run npm run dev as usual.

Do include src/main.jsx: CurrencyProvider wraps the app there. Keep the whole public/fonts/ folder with its licenses. If you have independently edited these files since the original upload, merge those edits rather than replacing them blindly.

## Design

Self-hosted Bricolage Grotesque Variable for display/headline typography; Manrope Variable for body and controls. Both Latin and extended-Latin subsets plus their OFL licenses are supplied. The landing page retains the approved charcoal/vermilion/ivory foundation with purposeful olive, sand and outcome accents.

The revised story uses a bolder wishlist hero, editorial labels, compact connected walkthrough, custom SVG Reveal Fold illustration synchronized with the outcome tabs, a receipt-like outcome panel, delivery/cash choices, compact FAQs and a closing invitation. Hover motion is restrained; reduced motion is respected. The wishlist raster is illustrative, not a live product listing.

## Currency implementation

- Header offers 16 currencies including USD, NGN, GHS and KES.
- Saved manual choice takes priority. Otherwise mapped local time zones and browser regional locales suggest a currency; unknown hints fall back to USD. This is a suggestion, not verified country detection; no GPS/IP-location request is made.
- Landing monetary values, FAQ shipping threshold, example product/cash amounts, and the navbar balance use the shared display formatter.
- Daily reference data is requested from ExchangeRate-API's open-access USD endpoint. A validated local cache is reused until its next update; data older than 48 hours is rejected. Requests time out after eight seconds. Attribution appears below the landing page.
- Non-USD values are marked approximate and identify their currency code. When data is missing or fails, amounts stay explicitly in USD. No hardcoded substitute exchange rates are used in the new formatter.
- This is DISPLAY conversion. It does not change account balances, deposit crediting, payout calculations, currencies submitted to financial RPCs, or create binding quotes.
- Remaining legacy dashboard/wallet/legal components still contain their original USD/NGN formatting. Their complete conversion rollout and financial quote integration are separate work; do not treat this as whole-platform payment localization.

## Verification

Production build passed; lint on changed application modules passed. Seven currency tests passed (run node --test tests/currency.test.js). Browser checks covered 320, 360, 390, 768, 1024 and 1440px with no horizontal overflow, successful image loads and self-hosted fonts. Outcome selection and keyboard arrows, FAQ expansion, auth dialog open/focus/Escape and referral capture passed.

Currency browser checks used controlled test rates to verify NGN/GHS/KES amounts, persistence after reload, regional hints, unknown-region USD default and explicit USD fallback after a rate-service failure. The real rate endpoint also returned HTTP 200 with NGN/GHS/KES present. Actual OTP delivery, live login, deposits, payouts, and production accounts were not tested.

The pre-existing full-project lint issue in AdminDashboard.jsx and previously identified financial-engine discrepancies remain unchanged. No backend or SQL files were changed, no live deployment was made, and no new stake or reward formulas were invented.

## Included files

- src/pages/Landing.jsx
- src/styles/pages/Landing.css
- src/components/Brand.jsx
- src/components/Navbar.jsx
- src/styles/components/Navbar.css
- src/components/Footer.jsx
- src/styles/components/Footer.css
- src/components/AuthModal.jsx
- src/styles/components/AuthModal.css
- public/reveal-fold.svg
- public/favicon.svg
- public/manifest.json
- public/images/wishlist-editorial.png
- index.html
- src/main.jsx
- src/context/CurrencyContext.jsx
- src/services/currency.js
- src/components/CurrencySelector.jsx
- src/components/RevealIllustration.jsx
- src/styles/typography.css
- tests/currency.test.js
- public/fonts/bricolage-grotesque-latin-wght-normal.woff2
- public/fonts/manrope-latin-wght-normal.woff2
- public/fonts/manrope-latin-ext-wght-normal.woff2
- public/fonts/manrope-LICENSE.txt
- public/fonts/bricolage-grotesque-LICENSE.txt
- public/fonts/bricolage-grotesque-latin-ext-wght-normal.woff2

## First-paint loader fix

Added a branded loading screen directly in index.html with critical inline dark-background styling. It renders before JavaScript, fonts or application CSS. React renders PageLoader while authentication initializes instead of returning null. The loader disappears when the app is ready, without an artificial minimum delay, and respects reduced motion. No financial behavior changed.

Additional validation: production build and lint on App/PageLoader passed. Browser check verified the static loader with the main module deliberately blocked, dark first paint, narrow-screen sizing, reduced motion, and removal after actual app startup with placeholder Supabase configuration.

## Font and copy update

Replaced the active font pair with Outfit Variable (headings and wordmark) and DM Sans Variable (body and controls). WOFF2 files, extended-Latin subsets and licenses are included in public/fonts. Fonts load from your own site with @font-face rules in src/styles/typography.css, imported by src/index.css; index.html preloads the primary Latin subsets. There is no Google Fonts request or new npm dependency.

The global universal selector now inherits the document font instead of assigning a system font directly to every element. Landing typography remains explicitly styled. Main body text is 15-16px and navigation is 13px. The intentionally system-font initial loader does not wait for custom fonts.

Simplified landing copy to describe product selection, stakes, outcomes and claim choices directly. Removed em dashes from the frontend source, title/social metadata, and customer-facing email footer. Dashboard and UGC files have punctuation-only changes. Email backend logic is unchanged. Legacy source comments can still contain dashes; these are not displayed to customers.

Verified real rendered fonts using Chromium platform-font inspection, not only CSS family names: heading glyphs use Outfit and body/navigation glyphs use DM Sans. Six viewport widths, currency checks and existing UI interaction checks passed; production build and lint of changed modules passed. Email template module syntax check passed. Actual email delivery was not exercised.

This is a font/copy pass, not the larger referral-section and middle-page redesign discussed in the audit. It does not change financial rules. Any earlier description of Bricolage/Manrope in these historical notes is superseded by this section. Their old font assets may remain in a previously updated local project but are no longer referenced.

## Game-led welcome update

The first interaction is now the free welcome wheel: two free retries followed by a USD 1 welcome reward, with email verification to claim. The USD 2 eligible-product cap and all welcome values use the chosen display currency. The scripted welcome sequence is disclosed separately from paid-game odds. Progress survives reload; local storage is presentation state only. Existing authentication and account-creation crediting remain responsible for the actual award. No new financial grant endpoint or paid-wheel change is included.

Added an interactive product-category preview, five-generation referral breakdown (10%, 5%, 4%, 3%, 2%) with localized examples, and delivery/cash-out proof previews. The combined 24% is explicitly across generations. Proof rewards have no invented fixed amount while their formula remains unresolved.

Header currency labels include decorative country flags from pinned Cloudflare cdnjs assets where the currency maps to a single country. Shared CFA currencies use a globe. A failed image leaves the globe and readable currency code available. Welcome sound is off until explicitly enabled, animation respects reduced motion, and repeated clicks are locked during a spin.

Validation: production build, changed-file lint and seven currency unit tests passed. Browser checks at 320, 360, 390, 768, 1024 and 1440px found no horizontal overflow. Tested the complete reduced-motion welcome sequence, reload persistence, localized claim, email-dialog handoff, category/referral/proof switches and CDN-failure fallback. Live email delivery and financial transactions were not exercised.

## Legal center redesign

The existing /legal?tab=terms, rules and privacy URLs now open a shared branded reading layout. Document navigation shows the current page, section links can be bookmarked, and invalid document keys fall back to Terms of use. The legal header and footer share the public site styling.

The copy separates wallet money from the stake, explains all three outcomes and the delivery/wallet choice, and uses the existing display currency selector. It removes the fixed proof rewards and unsupported treasury and instant-payout claims. The intended stake and retry rules are identified as planned because the paid engine still needs reconciliation. The terms and privacy copy is a product draft and needs review against actual operations before publication.

Validated the production build, changed-file lint, and all three routes at six widths. Browser checks included footer navigation, keyboard document changes, section links after reload, invalid-document fallback, and currency switching with fixture rates.
