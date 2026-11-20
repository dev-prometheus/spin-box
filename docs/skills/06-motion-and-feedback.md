# Motion, wheel and feedback

## Purpose first

Use motion for feedback, orientation and readable state changes. Avoid decorative movement on money users are reading or committing. High-frequency interactions should feel immediate; never delay input to finish animation. Keep ordinary transitions brief, typically around 120–250ms as an initial tuning range, and adjust based on actual rendered behavior.

Prefer CSS transitions for simple state changes, WAAPI for controlled browser animation and a motion library only when the project needs its gesture/layout capabilities. Favor transform and opacity, but measure actual performance instead of promising automatic GPU acceleration. Do not inherit unverified blanket performance claims from references.

## Paid wheel

Animate toward the recorded server outcome. Animation does not determine the financial result and must not invent another result after refresh. Display only the three paid outcome types. Keep welcome presentation separate. Do not imply equal probabilities from sector geometry when actual probabilities differ; provide accurate probability information once decided.

Use elapsed timestamps rather than assuming every frame is 16ms. Cancel animation frames on cleanup. Persist/recover round state independently of wheel animation. Reduced motion should allow a short/static result reveal without waiting through a long spin. Always provide a textual outcome and exact monetary consequence outside the canvas.

Never celebrate a loss, fabricate near misses, or automatically start another paid round. Retry preserves the confirmed same-stake behavior; no animation or gesture may accidentally submit a second charge.

## Drawers and controls

Give immediate visual press feedback while committing actions on normal click/keyboard activation. Keep gestures interruptible where appropriate, with a visible non-gesture alternative. Prevent duplicate financial mutations, but do not freeze the whole interface while awaiting a response. Use focus management independent of animation.

Gate hover motion to capable pointers. Respect prefers-reduced-motion, do not use flashing backgrounds and avoid perpetual decorative loops. Sound and vibration should be optional, initiated only after user interaction, and easy to mute; reuse/close audio resources responsibly.

## Review

Inspect under CPU throttling, rapid toggles, slow responses and reduced motion. Check that result, balance and text agree. Verify inputs remain accessible during transitions. Document actual observations rather than judging motion from code alone.
