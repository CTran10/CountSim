# TrueEdge

TrueEdge is a local-first blackjack simulation and training lab. It combines a
deterministic, rule-aware engine with Hi-Lo counting, basic strategy, I18 and
Fab 4 deviations, Black Hawk training presets, targeted drills, replay, hard
virtual-bankroll limits, and local progress tracking.

It is training software. Funds are virtual, and there are no accounts,
payments, deposits, casino connections, or real-money wagering.

## Run locally

Requirements: Node.js 24 or newer and pnpm 11.1.3.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000`. The seven product screens are Home, Games,
Session Setup, Table, Drills, Review, and Progress.

## Desktop app

TrueEdge can run as a self-contained Electron app. The desktop build bundles a
production Next.js server and starts it on a private loopback port, so friends
do not need Node.js, pnpm, or an internet connection after installation.

```bash
pnpm desktop:dev
pnpm desktop:pack
pnpm desktop:dist:mac
```

`desktop:pack` creates an unpacked application for the current platform.
`desktop:dist:mac` creates separate Intel and Apple Silicon DMG and ZIP artifacts
under `release/`; share the artifact matching the recipient's Mac. Windows NSIS
and Linux AppImage targets are configured and should be built on their native
operating systems or matching CI runners.

Local macOS artifacts are unsigned. For click-through distribution without a
Gatekeeper warning, provide an Apple Developer ID certificate and notarization
credentials in the build environment. Those credentials are intentionally not
stored in this repository.

## Deterministic simulation CLI

Run a catalog rules profile without the browser:

```bash
pnpm simulate -- --preset lodge-6d --hands 10000 --seed 785390425
pnpm simulate -- --rules ameristar-dd --penetration 68 --hands 5000 --json
```

Use `pnpm simulate -- --help` for all options. The output reports wins, losses,
pushes, blackjacks, true-count opportunities, and deviation capture. It is
TrueEdge simulation output, not a claim about casino results or expected value.

## Catalog evidence boundary

The catalog contains separate Double Deck and Six Deck training profiles for
Bally's North, Bally's West, The Lodge, Ameristar, and Monarch in Black Hawk,
Colorado. Official venue pages establish only the availability stated by each
source. Exact rules and historical minimums are dated observations, and
penetration is labeled as an adjustable training default where no defensible
observation exists.

The statewide baseline is [Colorado Gaming Regulation Rule 8](https://www.sos.state.co.us/CCR/GenerateRulePdf.do?ruleVersionId=52),
effective April 14, 2025. It requires posted table conditions but does not prove
the current conditions at a particular property or table. Verify the placard
and house rules before relying on any preset.

## Architecture

- `packages/game-core`: deterministic blackjack, shoe, counting, strategy,
  deviations, training scheduler, simulation, and replay
- `packages/casino-catalog`: sourced and validated Black Hawk data only; the
  engine contains no casino-name branches
- `apps/web`: Next.js product UI and validated local persistence
- `apps/desktop`: Electron host and offline desktop packaging
- `apps/cli`: deterministic simulation command
- `gan-harness`: release specification and evaluation rubric

Deterministic core decisions do not use ambient time or `Math.random`. Replay
records schema and algorithm versions, resolved shoes and penetration, accepted
commands, elapsed command times, rules, seed, shuffle mode, and a final digest.
The simulated hand shuffle uses a deterministic riffle, riffle, strip, riffle,
and cut sequence. Continuous-shuffler mode is an explicit approximation that
progressively returns a seeded portion of the discard pool between rounds; it
does not claim to reproduce a commercial machine.

## Verify

```bash
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm e2e
```

Playing-card asset provenance and the preserved upstream license are in
`apps/web/public/cards/SOURCE.md` and `apps/web/public/cards/LICENSE.txt`.
