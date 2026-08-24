# TrueEdge Full MVP Evaluation Rubric

Score each category from 0 to 10. Passing requires:

- weighted overall score of at least 8.5;
- no category below 7;
- no critical failure;
- three consecutive green runs for release-critical deterministic tests and
  evals.

## Critical failures

Any one of these fails the evaluation regardless of weighted score:

- a seeded replay produces different cards, actions, sampled penetration, cut
  index, settlement, or final digest;
- an invalid/rejected command advances deterministic state;
- a disallowed action or payout is accepted for the active rules;
- a hard session limit can be loosened, bypassed, or continued through;
- casino estimates are presented as live/current facts without dated source,
  confidence, and change warning;
- the UI facilitates real wagering, deposits, crypto, or casino play;
- unsafe replay/local-data parsing can crash the product or render injected
  markup;
- the 390px critical flow has horizontal overflow or unusable controls;
- coverage for branches, functions, lines, or statements is below 80%.

## Scored categories

### 1. Determinism, replay, and failure purity (14%)

- Versioned seeded RNG/shuffle and deterministic penetration sampling.
- Stable resolved shoe, cut index, commands, settlements, events, and digest.
- Replay scrubbing and mistake replay reconstruct exact states.
- Rejected commands do not mutate state, event history, cursor, or digest.
- Injected/event-relative time keeps decision analytics replay-safe.

### 2. Blackjack rules and settlement correctness (14%)

- Deal, Hit, Stand, Double, Split/resplit, Insurance, and Surrender.
- 1/2/4/6/8 decks; 3:2/6:5; H17/S17; double restrictions; DAS; RSA;
  split-ace behavior; max hands; peek; naturals; pushes and busts.
- Only legal actions are offered and accepted for every hand/rules state.
- Complete independent fixtures cover split and multi-hand settlement.

### 3. Shoe, penetration, shuffle, and counting correctness (11%)

- Unique physical cards, cut-card/discard behavior, and round-safe reshuffle.
- Fixed, range, and observed penetration sample deterministically.
- Perfect/automatic behavior is honest; hand shuffle and CSM are modeled or
  explained without unsupported commercial-procedure claims.
- Public card exposure drives Hi-Lo exactly once per card, including hole-card
  reveal; RC resets at shuffle.
- Whole/half/quarter deck estimates and truncate/floor/nearest TC fixtures.

### 4. Strategy, deviations, and explanations (11%)

- Strategy is rules-aware, versioned, and headless.
- Deviation selection uses deck class/count, H17/S17, DAS/surrender context,
  Hi-Lo, true-count convention, and compatible profile.
- I18 + Fab 4 works for shipped Double Deck and Six Deck H17 profiles; S17 and
  custom/full profile extension points are real, not hardcoded labels.
- Why explains base play, count math, index threshold, profile, and changed
  recommendation in plain language.

### 5. Session limits and responsible product behavior (10%)

- Virtual bankroll and no-real-money boundary are always clear.
- Stop-loss, win stop, maximum bet, hand limit, and duration validate at setup.
- Limits lock on start; maximum bet/loss exposure may only tighten.
- Every reached limit ends the session without a continue bypass.
- Decision quality and discipline outrank profit in hierarchy and copy.

### 6. Training modes and adaptive learning (10%)

- Play, Observation, Practice, and Decision each have distinct behavior.
- Drill covers RC, deck estimate, TC, basic strategy, deviations, penetration,
  and full mental load.
- Feedback shows expected/submitted values, signed error, and meaningful error
  class.
- Skill scores and deterministic weighted scheduling target actual weaknesses.
- Generated scenarios are clearly labeled and reproducible.

### 7. Catalog, comparison, custom rules, and provenance (9%)

- Ten separate Black Hawk presets across Bally's North/West, Lodge, Ameristar,
  and Monarch.
- Presets are data, never engine branches.
- Compare aligns material rule, penetration, deviation, limit, date, and
  confidence differences.
- Custom game validation/persistence covers the full MVP rules surface.
- Observation/date/source/confidence and historical/training-default language
  is accurate; casino-change warning is prominent.

### 8. Review, analytics, persistence, and CLI (8%)

- Review shows technical skill, discipline, P/L, decision time, mistakes, and
  replay with decision quality visually dominant.
- Progress stores attempts, trends, recent misses, and weakest-skill action.
- Versioned local data survives reload and fails safely when corrupt or stale.
- Deterministic CLI accepts rules, penetration, seed, and hands and reports
  outcomes, high-TC frequency, and deviation opportunities honestly.

### 9. Product UI and responsive experience (7%)

- All seven screens form one clear, fast user journey.
- Restrained dark instrument-panel language, flat felt, one amber accent, sharp
  geometry, and compact information hierarchy.
- No gradients, glassmorphism, purple AI tropes, giant hero, excessive pills,
  nested card walls, fake terminal, or casino spectacle.
- Desktop rail and 390px disclosure preserve hierarchy with no overflow.
- Loading, first-run, empty, invalid-data, and completion states are intentional.

### 10. Accessibility, security, architecture, and verification (6%)

- Semantic navigation/landmarks, labels/errors, visible focus, keyboard game
  flow, live announcements, card alt text, contrast, and reduced motion.
- Local/replay inputs are schema-validated and size-limited; authored content is
  rendered as text; no secrets, debug artifacts, or network side effects.
- Headless engines contain no React, Next, DOM, storage, casino IDs, ambient
  time, or `Math.random` dependencies.
- Behavior-focused unit, integration, CLI, and E2E proof is green; all four
  coverage dimensions are at least 80%; lint/typecheck/format/build pass.

## Evaluator procedure

1. Run unit/integration tests and coverage from a clean process.
2. Run deterministic capability/regression evals three times; record pass@1,
   pass@3, and failure signatures.
3. Run CLI fixtures twice with the same seed and compare normalized output.
4. Run Playwright for desktop Chromium and mobile-390.
5. Inspect Home, Game Selection/Compare/Custom, Setup, Table in all four modes,
   Drill, Review, and Progress.
6. Complete one hard-limit session and one deliberately incorrect drill.
7. Reload to verify persistence, then inject corrupt local data and verify safe
   recovery.
8. Inspect representative Double Deck and Six Deck strategy/deviation fixtures,
   at least one split/insurance/surrender scenario, and replay parity.
9. Review UI at 1440px, 768px, and 390px, including keyboard-only and reduced
   motion behavior.
10. Review the final diff for casino-claim honesty, debug artifacts, secrets,
    unsafe parsing, and unrelated scope.
