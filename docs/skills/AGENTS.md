# TemuSpinBox project instructions

Read this file before planning or changing this project. Treat the files in docs/skills as project playbooks, not globally installed tools. If an AGENTS.md already exists, merge these instructions with it; do not overwrite unrelated repository requirements.

## Authority

Follow the user's latest explicit decisions first. Read the current project specification and relevant code/schema next. Treat historical generated blueprints as background. Do not convert example amounts or current implementation bugs into business rules. Record decisions once in docs/skills/01-product-rules.md; update affected guides when a decision changes.

## Route the task

| Task | Read |
| --- | --- |
| Product behavior, money, formulas | docs/skills/01-product-rules.md |
| Palettes, typography, brand, components | docs/skills/02-visual-direction.md |
| Landing, onboarding, words and claims | docs/skills/03-landing-and-copy.md |
| Player app, wallet, orders, admin, responsive layouts | docs/skills/04-app-experience.md |
| React components, fetching and performance | docs/skills/05-frontend-engineering.md |
| Wheel, drawers, transitions, sound | docs/skills/06-motion-and-feedback.md |
| Review, accessibility, release checks | docs/skills/07-quality-review.md |

Read only guides relevant to the task, plus product rules for changes affecting money or outcomes. Preserve React/Vite, Express, Supabase and existing custom CSS unless a concrete need supports a change. Keep code out of chat unless requested; return edited files and brief changes/verification notes.

Start with three palette/typography/layout directions shown on a landing hero and signed-in play screen, mobile and desktop. Keep explorations separate from production. Let the user select a direction before carrying it across the platform. Do not start financial implementation with invented formulas. Continue independent visual work while economic questions remain open.

Report what changed, what was actually verified, and remaining limits. Never claim a screenshot proves backend behavior or that a source review confirms deployed database state.
