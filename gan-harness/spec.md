# TrueEdge Full MVP Specification

## Product outcome

TrueEdge is a local-first blackjack simulation and training product for players
who want to practice the kind of games they expect to encounter. It combines a
deterministic blackjack engine with realistic shoe state, rule-aware strategy,
Hi-Lo counting, deck-specific deviations, skill training, and immutable virtual
bankroll limits.

The product must feel like a fast, restrained blackjack game first. Training
information is progressive disclosure, not a wall of dashboard cards.

## Required user journey

1. Open Home and choose Play or Train.
2. Select a Black Hawk preset, compare two presets, or save a custom local
   ruleset.
3. Configure virtual bankroll, training intent, and hard session limits.
4. Play a reproducible shoe using all actions allowed by the selected rules.
5. Switch among Play, Observation, Practice, and Decision behavior, or launch a
   targeted Drill.
6. Finish the session at a user-defined hard stop and review technical quality,
   discipline, mistakes, and replay.
7. Return later and see local skill progress and saved custom games.

## Information architecture

Seven primary screens are required:

1. **Home** at `/`
2. **Game Selection** at `/games`, with Compare and Custom Game subviews
3. **Session Setup** at `/setup`
4. **Blackjack Table** at `/play`
5. **Drill** at `/drill`
6. **Session Review** at `/review`
7. **Progress** at `/progress`

Compare and Custom Game may use nested routes or accessible views within Game
Selection. Navigation must preserve the user's selected preset or local custom
game through setup and play.

## Home

- Explain the product in one compact statement: learn blackjack by playing it.
- Provide clear Play and Train actions.
- Show the locally persisted skill summary for basic strategy, running count,
  deck estimation, true count, deviations, and insurance.
- Show a useful first-run state when no attempts exist.
- Do not use casino spectacle, fake social proof, or profit-led language.

## Game Selection, Compare, and Custom Game

### Black Hawk catalog

The data catalog includes separate Double Deck and Six Deck presets for:

- Bally's North
- Bally's West
- The Lodge
- Ameristar
- Monarch

Each preset exposes rules, deck count, deviation profile, penetration profile,
dated provenance, confidence, and historical limits when defensible. The
catalog is data only; the game engine must contain no casino-name branches.

Official evidence that a property offers blackjack does not prove an exact
ruleset, minimum, or penetration. Every condition claim must be one of:

- a dated observation with source and low, medium, or high confidence;
- a clearly labeled historical limit; or
- an adjustable **training default** labeled as not reliably verified.

The UI must state that casino conditions may have changed. It must never imply
that a historical observation is current live table inventory.

### Compare

Compare any two catalog or saved custom games in aligned fields: decks,
blackjack payout, H17/S17, doubling, DAS, RSA, surrender, split limits,
penetration, deviation profile, historical limits, observation date, and
confidence. Any simulated quality metrics must be visibly labeled as TrueEdge
simulation output rather than casino facts.

### Custom Game

Create, validate, save, reopen, and delete local presets with:

- 1, 2, 4, 6, or 8 decks;
- 3:2 or 6:5 blackjack;
- H17 or S17;
- double on any two, 9/10/11, or 10/11;
- DAS, resplit aces, hit split aces, and double split aces;
- no, late, or early surrender;
- maximum split hands;
- dealer peek and burn card;
- fixed, range, or observed-distribution penetration;
- perfect random, simulated hand shuffle, automatic shuffle, or CSM behavior;
- a compatible Hi-Lo deviation profile.

Invalid ranges and incompatible choices are explained beside the relevant
control. User-authored names and notes render as text, never HTML.

## Session Setup and hard limits

Before a Play session the user configures:

- starting virtual bankroll;
- stop-loss;
- win stop;
- maximum bet;
- hand limit;
- session duration;
- practice intent: basic strategy, running count, deck estimation, true count,
  deviations, or full game;
- counting conventions: whole, half, or quarter-deck estimation and truncate,
  floor, or nearest true-count resolution.

All funds are labeled virtual practice funds. There are no deposits, payments,
crypto, casino links, or real wagering.

Once play starts, the initial rules and limits are replay inputs. Maximum bet
and permitted loss may be tightened, but never increased or loosened within the
session. Reaching stop-loss, win stop, hand limit, or duration completes the
session without a continue override. The user can start a new session.

## Blackjack and shoe engine

The headless engine supports:

- Deal, Hit, Stand, Double, Split and resplit, Insurance, and Surrender when
  allowed;
- split aces, RSA, split-hand limits, DAS, dealer peek, 3:2 and 6:5 naturals,
  H17 and S17 dealer play, pushes, busts, and all settlements;
- deterministic 1, 2, 4, 6, and 8-deck shoes with unique physical card IDs;
- a seeded, versioned shuffle and RNG contract;
- fixed, deterministic range, and deterministic observed-distribution
  penetration sampling;
- an actual cut card, discard tray, round-safe shuffle, decks remaining, and
  shoe progress;
- perfect random and automatic-shuffle MVP behavior, with honest explanatory
  behavior for simulated hand shuffle and CSM;
- no use of ambient time or `Math.random` in deterministic decisions.

Generated action and decision fixtures are valid product training scenarios,
must say **Generated Training Scenario**, and must never be presented as a
naturally dealt casino shoe.

## Counting, strategy, and deviations

- Hi-Lo values are 2-6 = +1, 7-9 = 0, and 10-A = -1.
- Only public card-exposure events affect the visible count; a dealer hole card
  counts exactly once when revealed.
- Show running count, cards seen, decks remaining, raw true count, resolved true
  count, penetration, and the active estimation/resolution convention.
- Basic strategy is resolved from the complete rules context and returns the
  action, explanation, ruleset ID, and algorithm version.
- Deviations resolve from hand, upcard, rules, deck class/count, count system,
  true count, and selected index set.
- Ship Hi-Lo I18 + Fab 4 as the default advanced package, including Double Deck
  H17 and Six Deck H17 profiles. The architecture also accepts S17 and custom or
  fuller index sets.
- A Why interaction explains the base action, current game rules, count math,
  index/profile, comparison threshold, and changed recommendation.

## Product modes

### Play

Normal blackjack with training overlays hidden until requested. After a hand,
show compact feedback for strategy, count, and deviation quality. Do not reward
profit more strongly than decision quality.

### Observation

Show the complete reasoning chain while cards and decisions occur:

`card -> RC -> deck estimate -> TC -> index -> correct action`

The rail includes shoe/cut state, strategy, active deviation profile, and a Why
explanation. For CSM games, explain why traditional shoe counting does not
apply in the same way.

### Practice

Play a real hand while periodically answering running-count, deck-estimate,
true-count, or penetration questions. Reveal actual value, submitted value,
and signed error without corrupting game state.

### Decision

Present a hand and legal actions, reveal the correct rule-aware decision, and
classify mistakes as basic strategy, count, deck estimation, true count, or
deviation errors.

## Drill and adaptive training

Drill offers short, keyboard-usable sessions for:

- running count;
- deck estimation at whole, half, and quarter-deck precision;
- true-count conversion;
- basic strategy;
- I18 + Fab 4 deviations;
- penetration estimation; and
- full mental load.

Each attempt records prompt context, answer, expected answer, correctness,
error class, decision time, and algorithm/profile version. Skill scores are
computed separately. A deterministic weighted scheduler biases future prompts
toward weaker and more recently missed skills while remaining reproducible for
a seed. Training scenarios are explicitly labeled as generated.

## Review, replay, and progress

Session Review emphasizes decision quality and discipline ahead of profit. It
shows strategy, RC, deck estimate, TC, deviation, decision-time, net-result, and
discipline metrics. A losing session can be technically excellent.

The mistake timeline shows the hand/prompt context, submitted action or value,
correct answer, active count and rules context, and error class. Review Mistakes
replays only failed situations.

Shoe replay stores schema/algorithm versions, seed, rules, preset/provenance
reference, sampled penetration and cut index, shuffle configuration, resolved
shoe, bets, successful actions, training submissions, and replay-relative event
offsets. It can scrub by hand and reproduce the same state and digest. Imported
replay data, if exposed, must be schema-validated and size-limited before use.

Progress persists locally and shows skill score, attempts, trend, recent
mistakes, and weakest-skill recommendation. Saved custom games, completed
sessions, drill attempts, and progress survive reload. Corrupt or unsupported
local data falls back safely with an honest recovery state.

## Simulation interface

Expose the headless engine through a documented, deterministic CLI capable of
running a selected rules profile, penetration configuration, seed, and hand
count. Output at minimum wins, losses, pushes, blackjacks, high-true-count
frequency, and deviation opportunities. Estimated EV, when present, is labeled
simulation output.

The CLI is verified at the package/test level and does not need a browser
screen. Browser UI may link to local documentation, but must not fake a terminal
inside the product.

## UI and interaction direction

- One dark theme, one amber signal color, flat felt, white/red cards, sharp
  geometry, and compact typography.
- No gradients, glassmorphism, purple AI styling, giant headline, excessive
  pills, nested card walls, decorative casino scene, fake terminal, or
  ornamental animation.
- Desktop table uses a right training rail. At 390px it becomes a compact,
  keyboard-operable bottom disclosure without horizontal overflow.
- Motion is limited to short state feedback and card movement, uses stable
  layout space, and respects `prefers-reduced-motion`.
- Semantic landmarks, visible focus, complete form labels/errors, live result
  announcements, sufficient contrast, alt text for cards, and keyboard actions
  are required.
- Loading, first-run/empty, invalid-data, and completed states are deliberate.

## Architecture constraints

- React renders selectors and dispatches commands. Blackjack, shoe, counting,
  strategy, deviation, training, catalog, session, persistence validation, and
  replay logic remain headless.
- No casino-specific conditionals in blackjack logic.
- Invalid commands are pure rejections: state, events, deterministic cursor,
  and digest do not change.
- Time-based analytics use injected or event-relative time. Replay determinism
  does not depend on the wall clock.
- Local persistence is versioned, validated at read boundaries, and avoids
  secrets or sensitive personal data.

## Required proof

- Unit fixtures cover all gameplay/rules branches, penetration modes, count and
  TC resolution, every supported deviation profile, adaptive scheduling,
  immutable limits, persistence validation, and replay.
- Integration tests prove catalog-to-setup-to-engine configuration, saved
  custom games, completed-session analytics, and progress derivation.
- Browser tests prove all seven screens, catalog provenance, compare/custom,
  hard-stop flow, advanced table actions, four modes, drills, review/progress
  persistence, keyboard use, and 390px behavior.
- Seeded capability and regression evals report pass@1 and pass@3 for release
  critical deterministic flows.
- Coverage is at least 80% for branches, functions, lines, and statements.
- Lint, typecheck, format check, build, unit/integration tests, CLI tests, and
  E2E are green with no debug artifacts or secrets.

## Explicitly deferred

Multiplayer and CPU seats, real money, accounts, payments, crypto, live casino
integration, native apps, live dealers, 3D graphics, side bets, Free Bet,
additional counting systems, exact commercial-shuffler reverse engineering,
automated scraping, crowdsourced live conditions, team counting, AI coaching,
and claims of exact casino-specific hand-shuffle reconstruction are not MVP.
