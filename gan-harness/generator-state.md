# Generator state — Iteration 002

## Implemented scope

- Deterministic six-deck, 75% penetration shoe using versioned seeded shuffle.
- Headless Deal, Hit, Stand, H17 dealer play, 3:2 naturals, settlement, stop-loss, and maximum-bet enforcement.
- Public-exposure Hi-Lo observation with hidden dealer hole cards and count reset between shoes.
- Versioned replay export with resolved shoe history, accepted commands, and deterministic digest.
- Responsive Next.js table for desktop, tablet, and 390px Chromium with keyboard controls and accessible live status.

## Iteration 002 changes

- Constrained session seeds to the RNG's unsigned 32-bit domain.
- Remount sessions when route seeds change.
- Moved the compact observation rail to a 900px breakpoint and defaulted it closed on narrow screens.
- Added an opaque, higher-contrast playing-card surface and reduced card overlap.
- Added disclosure state, semantic action groups, and higher-contrast small labels.
- Added golden shuffle/digest, H17, 3:2, push, hole-card, reshuffle-count, seed-boundary, and navigation-reset tests.
- Added browser coverage for keyboard Hit, compact-rail toggling, invalid large seeds, and 768px layout.

## Deliberate limitations

- Slice 1 exposes Deal, Hit, and Stand only.
- No split, double, insurance, surrender, strategy advice, casino catalog, accounts, persistence, payments, or real-money features.
- Replay is exported locally; there is no untrusted replay-import UI in this slice.

## Verification commands

- `vitest run --coverage`
- `eslint .`
- `tsc -p packages/game-core/tsconfig.json --noEmit`
- `tsc -p apps/web/tsconfig.json --noEmit`
- `prettier --check .`
- `next build`
- `playwright test`

## Artifacts

- Evaluation rubric: `gan-harness/eval-rubric.md`
- Prior feedback: `gan-harness/feedback/feedback-001.md`
- Desktop/mobile/tablet review screenshots are captured by the evaluator under `/private/tmp`.
