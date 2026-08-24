# TrueEdge

TrueEdge is a local blackjack simulator built for basic strategy, realistic rules, card counting, and advantage-play training.

It combines a deterministic, rule-aware blackjack engine with Hi-Lo counting, basic strategy, I18 and Fab 4 deviations, Black Hawk casino presets, targeted drills, hand replay, virtual-bankroll limits, and local progress tracking.

This is strictly training software. Everything is virtual. There are no accounts, payments, deposits, casino integrations, or real-money wagering.

## Run locally

Requires Node.js 24+ and pnpm 11.1.3.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Then open http://127.0.0.1:3000.

The app is split into seven main screens:

- Home
- Games
- Session Setup
- Table
- Drills
- Review
- Progress

## Desktop app

TrueEdge can also run as a completely self-contained Electron app.

The desktop build bundles its own production Next.js server and runs it over a private loopback port. Once installed, it doesn’t require Node.js, pnpm, or an internet connection.

```bash
pnpm desktop:dev
pnpm desktop:pack
pnpm desktop:dist:mac
```

`desktop:pack` builds an unpacked application for your current platform.

`desktop:dist:mac` builds separate Intel and Apple Silicon DMG installers under `release/`. Just send whichever version matches the recipient’s Mac.

Windows NSIS and Linux AppImage targets are also configured, but should be built on their native OS or a matching CI runner.

GitHub and local macOS builds are ad-hoc signed, so they do not require an Apple Developer account, but they are not Developer ID signed or notarized. On first launch, macOS may block the app. Try opening it once, then go to **System Settings → Privacy & Security** and choose **Open Anyway**.

These builds cannot use Electron’s trusted automatic in-place updater. To update TrueEdge, download the newer DMG from the latest GitHub release and replace the installed app. Normal click-through installation and automatic updates require an Apple Developer ID certificate and notarization.

## Deterministic simulation CLI

You can run the simulation engine directly without touching the browser:

```bash
pnpm simulate -- --preset lodge-6d --hands 10000 --seed 785390425
pnpm simulate -- --rules ameristar-dd --penetration 68 --hands 5000 --json
```

Run:

```bash
pnpm simulate -- --help
```

for the full set of options.

Simulation output includes wins, losses, pushes, blackjacks, true-count opportunities, and deviation capture.

These are TrueEdge simulation results. They are not claims about real casino results or expected value.

## Catalog evidence boundary

TrueEdge includes separate Double Deck and Six Deck training profiles for:

- Bally’s North
- Bally’s West
- The Lodge
- Ameristar
- Monarch

All profiles are for Black Hawk, Colorado.

The catalog intentionally separates what can actually be sourced from what is only an observation or training assumption.

Official venue sources are only used to establish what those sources explicitly support. Exact rules and historical minimums are treated as dated observations, while penetration is an adjustable training default anywhere a defensible observation isn’t available.

The statewide baseline is Colorado Gaming Regulation Rule 8, effective April 14, 2025.

Rule 8 requires table conditions to be posted, but that doesn’t mean a preset can guarantee what a specific casino or table is running today. Check the actual placard and house rules before treating a preset as current.

## Architecture

TrueEdge is split into a few intentionally separate pieces:

- `packages/game-core` — deterministic blackjack, shoe management, counting, strategy, deviations, training scheduling, simulation, and replay
- `packages/casino-catalog` — sourced and validated Black Hawk data; casino-specific logic stays out of the engine
- `apps/web` — Next.js UI and validated local persistence
- `apps/desktop` — Electron host and offline desktop packaging
- `apps/cli` — deterministic simulation CLI
- `gan-harness` — release specification and evaluation rubric

The core simulation never depends on ambient time or `Math.random`.

Replay records enough information to reproduce and inspect a session, including:

- schema and algorithm versions
- resolved shoes and penetration
- accepted commands
- elapsed command times
- rules
- seed
- shuffle mode
- final digest

The normal simulated shoe uses a deterministic:

```text
riffle → riffle → strip → riffle → cut
```

shuffle sequence.

Continuous-shuffler mode is intentionally modeled as an approximation. It progressively returns a seeded portion of the discard pool between rounds rather than pretending to perfectly reproduce the internals of a commercial CSM.

## Verify

The full project can be checked with:

```bash
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm e2e
```

Playing-card asset provenance and the original upstream license are preserved in:

- `apps/web/public/cards/SOURCE.md`
- `apps/web/public/cards/LICENSE.txt`
