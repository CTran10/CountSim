# Evaluation — Iteration 001

## Scores

| Criterion                    |  Score | Weight |    Weighted |
| ---------------------------- | -----: | -----: | ----------: |
| Deterministic correctness    | 9.0/10 |   0.25 |        2.25 |
| Blackjack correctness        | 7.8/10 |   0.20 |        1.56 |
| Shoe and count correctness   | 8.0/10 |   0.15 |        1.20 |
| Session discipline           | 8.5/10 |   0.10 |        0.85 |
| Architecture                 | 9.5/10 |   0.10 |        0.95 |
| Product UI                   | 6.5/10 |   0.10 |        0.65 |
| Accessibility and resilience | 8.0/10 |   0.05 |        0.40 |
| Verification quality         | 7.0/10 |   0.05 |        0.35 |
| **TOTAL**                    |        |        | **8.21/10** |

## Verdict: FAIL

The weighted score clears 8.0, but Product UI is below the rubric's required 7.0 category floor.

## Critical Issues (must fix)

1. **The responsive transition is broken at tablet width.** At 768px, the fixed `310px` observation rail from `BlackjackTable.module.css:126` remains beside a roughly 457px table because the mobile layout does not begin until `720px` (`:599`). The table profile wraps to three lines while more than half of the rail is empty. At 390px, the rail is collapsible but defaults open, pushing the actual table below the first viewport. **Fix:** switch to the single-column, collapsible observation layout at a realistic tablet breakpoint (about 900px), default it collapsed on narrow screens, and keep it persistently open only when the two-column rail has enough room.

## Major Issues (should fix)

1. **Dealt cards are visually muddy and harder to parse than production cards.** The SVGs have transparent/gradient regions and `.card` at `BlackjackTable.module.css:231` supplies no opaque card surface; felt bleeds through the faces, and overlapping cards obscure ranks/suits. **Fix:** add an opaque warm-white card background and subtle border/inset edge, then reduce or responsively tune the negative overlap so each rank remains legible at desktop and 390px.
2. **Critical blackjack/count rules are implemented but not proven by explicit tests.** The suite covers general outcomes, hidden-hole initial count, replay, limits, and reshuffle, but has no targeted assertion for H17 dealer behavior, exact 3:2 bankroll profit, dealer-hole exposure exactly once, or exact count reset semantics. **Fix:** add behavior tests for soft-17 hit versus hard-17 stand, a natural paying `1.5 × wager`, repeated reveal paths preserving a single exposure, and the first post-cut deal starting from a reset count before its new public exposures.
3. **The browser proof is narrower than the claimed journey.** The committed E2E suite proves deterministic initial cards, a Stand round, replay JSON shape, invalid-seed fallback, and overflow, but it does not formally cover Hit, mobile rail collapse, keyboard control, stop-loss terminal UI, or rapid repeated actions. **Fix:** promote those paths into Playwright tests; the manual evaluator probes already showed collapse, keyboard Deal/Hit, and double-Deal purity working.

## Minor Issues (nice to fix)

1. **Harness state documentation is missing.** `gan-harness/generator-state.md` does not exist, so the evaluator cannot compare declared implementation state with observed behavior. **Fix:** add the iteration state file with implemented scope, known limitations, commands run, and current artifact paths.
2. **The dev toolbar bubble appears in local screenshots.** This is the Next.js development indicator, not application UI, and was excluded from the product score. **Fix:** capture final review screenshots from `next start` after a production build so review artifacts represent the shipped surface.

## What Improved Since Last Iteration

- Baseline iteration; no prior evaluator report exists for comparison.

## What Regressed Since Last Iteration

- Baseline iteration; no prior evaluator report exists for comparison.

## Specific Suggestions for Next Iteration

1. Move the observation rail into compact mode at tablet width and retest 390px, 768px, and 1440px after both initial load and a completed round.
2. Put an opaque surface behind every SVG card and visually verify overlapping red and black face cards.
3. Add the four missing rule-focused unit tests and the interaction-focused Playwright cases before rerunning the gate.

## Verification Evidence

- Playwright: 6/6 tests passed in Chromium and 390px Chromium.
- Additional live probes: mobile collapse/expand, keyboard Deal and Hit, rapid double-Deal purity, 390px overflow, and console/page errors all passed; no browser errors were observed.
- Vitest: 47/47 tests passed.
- Coverage: 90.81% statements, 86.73% branches, 97.33% functions, 91.89% lines.
- ESLint: passed.
- TypeScript: core and web projects passed.
- Next.js 16.3.2 production build: passed.
- Architecture scan: no React, Next, DOM, storage, network, ambient time, `Math.random`, or casino identifier references in `packages/game-core/src`.
- Debug/secret scan: no findings in application, package, or harness sources.

## Screenshots

- `/private/tmp/trueedge-eval-desktop.png`: strong desktop hierarchy and restrained palette; empty-state table is clear.
- `/private/tmp/trueedge-eval-round-desktop.png`: completed-round information is clear, but transparent card faces visibly blend into felt.
- `/private/tmp/trueedge-eval-mobile.png`: no horizontal overflow; the open observation panel consumes most of the first viewport.
- `/private/tmp/trueedge-eval-round-mobile.png`: controls remain usable after settlement; card overlap remains muddy.
- `/private/tmp/trueedge-eval-tablet.png`: fixed rail compresses the table and produces the failing intermediate-width composition.
