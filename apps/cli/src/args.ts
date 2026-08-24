import { getPreset } from "@trueedge/casino-catalog";
import type { GameRules } from "@trueedge/game-core";

export interface SimulationCliOptions {
  readonly seed: number;
  readonly rounds: number;
  readonly penetration: number;
  readonly threshold: number;
  readonly presetId: string;
  readonly deviationProfileId: string;
  readonly rules: GameRules;
  readonly json: boolean;
}

function numeric(value: string | undefined, label: string): number {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${label} requires a value.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be numeric.`);
  return parsed;
}

export function parseArgs(argv: readonly string[]): SimulationCliOptions {
  let seed = 785390425;
  let rounds = 10_000;
  let penetration: number | undefined;
  let threshold = 1;
  let presetId = "lodge-6d";
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--") continue;
    if (flag === "--json") {
      json = true;
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      throw new Error("HELP");
    }
    const value = argv[index + 1];
    if (flag === "--seed") seed = numeric(value, flag);
    else if (flag === "--hands" || flag === "--rounds") {
      rounds = numeric(value, flag);
    } else if (flag === "--penetration") {
      const parsed = numeric(value, flag);
      penetration = parsed > 1 ? parsed / 100 : parsed;
    } else if (flag === "--threshold") threshold = numeric(value, flag);
    else if (flag === "--preset" || flag === "--rules") {
      if (value === undefined) throw new Error(`${flag} requires a preset id.`);
      presetId = value;
    } else {
      throw new Error(`Unknown option: ${flag ?? ""}`);
    }
    index += 1;
  }

  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error("--seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100_000) {
    throw new Error("--hands must be a whole number from 1 to 100000.");
  }
  if (penetration !== undefined && (penetration <= 0 || penetration >= 1)) {
    throw new Error(
      "--penetration must be between 0 and 1, or 1 and 100 percent."
    );
  }
  const preset = getPreset(presetId);
  if (preset === undefined) throw new Error(`Unknown preset: ${presetId}`);
  const resolvedPenetration =
    penetration ??
    (preset.penetration.mode === "fixed"
      ? preset.penetration.penetration
      : preset.penetration.mode === "range"
        ? (preset.penetration.minPenetration +
            preset.penetration.maxPenetration) /
          2
        : preset.penetration.observations.reduce(
            (sum, observation) => sum + observation.penetration,
            0
          ) / preset.penetration.observations.length);

  return {
    seed,
    rounds,
    penetration: resolvedPenetration,
    threshold,
    presetId,
    deviationProfileId: preset.deviationSetId,
    rules: preset.rules,
    json
  };
}

export const HELP_TEXT = `TrueEdge deterministic simulation

Usage:
  pnpm simulate -- --preset lodge-6d --hands 10000 --seed 785390425

Options:
  --preset, --rules <id>  Black Hawk preset id (default: lodge-6d)
  --hands, --rounds <n>   Rounds to simulate, 1 to 100000
  --penetration <n>       Decimal or percent penetration
  --seed <n>              Unsigned 32-bit deterministic seed
  --threshold <n>         True-count opportunity threshold
  --json                  Emit machine-readable JSON
  --help                  Show this help`;
