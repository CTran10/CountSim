# Evaluation — Iteration 002

## Scores

| Criterion                    |  Score | Weight |    Weighted |
| ---------------------------- | -----: | -----: | ----------: |
| Deterministic correctness    | 9.2/10 |   0.25 |        2.30 |
| Blackjack correctness        | 9.0/10 |   0.20 |        1.80 |
| Shoe and count correctness   | 9.0/10 |   0.15 |        1.35 |
| Session discipline           | 9.0/10 |   0.10 |        0.90 |
| Architecture                 | 9.5/10 |   0.10 |        0.95 |
| Product UI                   | 8.3/10 |   0.10 |        0.83 |
| Accessibility and resilience | 8.5/10 |   0.05 |        0.43 |
| Verification quality         | 8.5/10 |   0.05 |        0.43 |
| **TOTAL**                    |        |        | **8.98/10** |

## Verdict: PASS

The score clears 8.0 and every category clears the required 7.0 floor. The iteration 001 product-UI blocker is resolved.

## Critical Issues (must fix)

None.

## Major Issues (should fix)

None.

## Minor Issues (nice to fix)

1. **The compact layout hides part of the locked profile.** At 768px and 390px the session strip omits `6D · H17 · 3:2`; only the 3:2 rule remains visible on the felt. **Fix:** replace the narrow felt rule label with a compact `6D · H17 · 3:2` line so mobile learners can confirm the complete supported profile without expanding unrelated content.
2. **Two resilience paths remain manual rather than committed browser proof.** Rapid double-Deal purity was manually verified, and terminal stop-loss is covered in the core suite, but neither has a dedicated Playwright assertion. **Fix:** add one rapid repeated-action test that checks replay contains one accepted Deal and one terminal-session test that verifies controls remain disabled with a visible stop reason.
3. **Desktop disclosure opens after hydration.** The observation `<details>` starts closed in server markup and is opened by a `matchMedia` effect, which can briefly present an empty rail on a slow device. **Fix:** if a measurable flash appears in production profiling, render a desktop-open default without changing the narrow-screen closed behavior; do not add state complexity unless the flash is observed.

## What Improved Since Last Iteration

- The compact observation breakpoint moved from 720px to 900px. At 768px the table now receives the full viewport width and the collapsed rail sits below it instead of consuming a fixed 310px column.
- The rail defaults closed at 768px and 390px, remains open at 1440px, and correctly resynchronizes when crossing the breakpoint in either direction.
- Cards now render on an opaque `#fbf8ef` surface with a defined border and reduced overlap. After the entry animation, computed opacity is `1` at every tested viewport; ranks and suits remain legible.
- Explicit tests now pin the shuffle sequence and final digest and cover H17, exact 3:2 profit, push bankroll, dealer-hole exposure once, count reset, seed bounds, and route-seed remounting.
- Browser coverage expanded from 6 to 10 passing cases, adding keyboard Deal/Hit, compact-rail toggling, invalid large seeds, and tablet layout.
- `gan-harness/generator-state.md` now records implemented scope, limits, checks, and artifacts.

## What Regressed Since Last Iteration

- No functional, responsive, accessibility, or verification regression was found.

## Specific Suggestions for Next Iteration

1. Preserve the current breakpoint and card treatment; add the compact full-profile label rather than redesigning the surface.
2. Promote rapid-command and terminal stop-loss browser probes into the maintained E2E suite.
3. Capture release screenshots from `next start` so the Next.js development indicator is absent from review artifacts.

## Verification Evidence

- Playwright: 10/10 tests passed across desktop Chromium and 390px Chromium after the final formatting change.
- Live viewport QA: 1440px, 768px, and 390px all had `scrollWidth === innerWidth` and no console or page errors.
- Disclosure behavior: initial states were open at 1440px and closed at 768px/390px; resize sequence was `open → closed → manually open → open → closed` across desktop/tablet/desktop/mobile.
- Post-animation cards: computed background `rgb(251, 248, 239)`, border `rgb(215, 208, 192)`, and opacity `1` at all three widths.
- Vitest: 56/56 tests passed.
- Coverage: 89.24% statements, 85.62% branches, 94.93% functions, and 90.34% lines.
- ESLint: passed.
- TypeScript: core and web projects passed.
- Prettier: all matched files passed after the E2E file was formatted.
- Next.js 16.3.2 production build: passed.
- Architecture scan: no React, Next, DOM, storage, network, ambient time, `Math.random`, or casino identifier references in `packages/game-core/src`.
- Debug/secret scan: no findings in application, package, or harness sources.

## Screenshots

- `/private/tmp/trueedge-002-desktop-round.png`: desktop rail, count hierarchy, settlement state, and opaque cards remain clear.
- `/private/tmp/trueedge-002-tablet-initial.png`: full-width table and collapsed observation row replace the failed fixed-rail composition.
- `/private/tmp/trueedge-002-tablet-round.png`: cards and controls remain legible with no intermediate-width crowding.
- `/private/tmp/trueedge-002-mobile-initial.png`: gameplay appears immediately; the observation rail is compact and closed.
- `/private/tmp/trueedge-002-mobile-round.png`: settled cards, result, controls, replay, and collapsed count summary fit without horizontal overflow.
