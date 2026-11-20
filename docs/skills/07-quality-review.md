# Quality review and handoff

## Review order

Check correctness and money clarity first, accessibility and task completion next, then visual composition and motion. A polished screen cannot compensate for incorrect financial settlement.

## Render matrix

Inspect approximately 360, 390, 768, 1024 and 1440px widths, plus content-driven intermediate sizes. Cover keyboard-only use, touch behavior, reduced motion, 200% zoom and text expansion. Aim for reflow without horizontal page scrolling at narrow widths; contain genuinely two-dimensional tables appropriately. Verify real devices when available and report emulator-only coverage honestly.

## Stress cases

Use very long product names, missing images, unavailable variants, large balances, decimal amounts, no history, many transactions, expired sessions, slow/failed requests, rapid navigation, duplicate clicks and concurrent tabs. Use synthetic fixtures and test accounts; do not exercise destructive cases against production.

Check long addresses, copy feedback, QR/network agreement, pending deposits, failed payouts, rejected-proof explanations, missing tracking and stale quotes. Ensure loading content reserves space and pending financial actions can be recovered after refresh.

## Accessibility

Use semantic landmarks, headings, buttons, labels and tables. Show visible focus; trap/return focus in dialogs, provide accessible names for icon controls and announce important status changes without excessive live-region chatter. Do not disable zoom. Keep controls generally around 44px touch targets. Check text and control contrast on actual backgrounds, including selected and focus states. Provide outcome text outside the wheel canvas.

## Design critique

Reject a phone-width desktop stack, tiny product preview, unreadable muted text, arbitrary spacing, duplicate nested borders, default browser controls mixed with styled ones, unexplained icons, inconsistent currency and fabricated evidence. Review all states, not just the populated happy path. Evaluate first-time comprehension without relying on an explanation from the developer.

## Report format

For each issue give severity, affected screen/file, evidence, user impact and concrete fix. Distinguish observed, source-inferred and untested findings. Mark monetary/security failures as blockers for real-money release; distinguish visual defects from economic decisions. Finish with changed files, checks actually run, unresolved items and next actionable step.

## Source adaptation note

These are original project-specific playbooks informed by the uploaded design engineering, Apple interaction, prototype, break-ui, animation, Vercel composition/performance, copywriting and specification references. They do not require the original ZIP paths to function. Do not import source authors' greeting rituals, global installation rules, mandatory pauses, tool dependencies or framework-specific recipes as product requirements. This pack does not install personal skills or change application code.
