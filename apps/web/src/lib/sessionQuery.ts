import { getPreset } from "@trueedge/casino-catalog";
import {
  DEFAULT_SESSION_CONFIG,
  assertValidGameRules,
  getDeviationProfile,
  resolveDeviationProfileForRules,
  resolvePenetration,
  type CountSettings,
  type GameRules,
  type PenetrationConfig,
  type SessionConfig,
  type ShuffleMode,
  type TrainingSkill
} from "@trueedge/game-core";

import type { TrainingMode } from "../features/table/TrainingRail";
import { catalogTableMinimumCents } from "./catalogPreset";
import { readSeed } from "./seed";

export type SearchQuery = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface ParsedSessionQuery {
  readonly config: SessionConfig;
  readonly mode: TrainingMode;
  readonly presetLabel: string;
  readonly tableMinimumCents: number;
}

function first(
  value: string | readonly string[] | undefined
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function boundedInteger(
  value: string | readonly string[] | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(first(value));
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function dollars(
  value: string | readonly string[] | undefined,
  fallbackCents: number,
  maximumCents = 100_000_000
): number {
  const parsed = Number(first(value));
  const cents = Math.round(parsed * 100);
  return Number.isFinite(parsed) && cents > 0 && cents <= maximumCents
    ? cents
    : fallbackCents;
}

function boolean(value: string | readonly string[] | undefined): boolean {
  return first(value) === "true";
}

function parseCountSettings(query: SearchQuery): CountSettings {
  const estimation = first(query.estimation);
  const resolution = first(query.resolution);
  return {
    estimation: ["exact", "quarter", "half", "whole"].includes(estimation ?? "")
      ? (estimation as CountSettings["estimation"])
      : DEFAULT_SESSION_CONFIG.count.estimation,
    resolution: ["truncate", "floor", "nearest"].includes(resolution ?? "")
      ? (resolution as CountSettings["resolution"])
      : DEFAULT_SESSION_CONFIG.count.resolution
  };
}

function parsePenetration(query: SearchQuery): PenetrationConfig {
  const mode = first(query.penetrationMode);
  if (mode === "range") {
    const minPenetration = Number(first(query.penetrationMin));
    const maxPenetration = Number(first(query.penetrationMax));
    const candidate: PenetrationConfig = {
      mode: "range",
      minPenetration,
      maxPenetration,
      notes: "User-defined local training range."
    };
    resolvePenetration(candidate, 1, 0);
    return candidate;
  }
  if (mode === "observed_distribution") {
    const values = (first(query.penetrationValues) ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    if (values.length < 2 || values.length > 40) {
      throw new Error("Observed penetration requires 2 to 40 values.");
    }
    const candidate: PenetrationConfig = {
      mode: "observed_distribution",
      observations: values.map((penetration) => ({
        penetration,
        observedAt: "local-profile",
        sourceType: "user",
        confidence: "low"
      })),
      fallbackPenetration:
        values.reduce((sum, value) => sum + value, 0) / values.length,
      notes: "User-entered local observations."
    };
    resolvePenetration(candidate, 1, 0);
    return candidate;
  }
  const penetration = Number(first(query.penetration));
  const candidate: PenetrationConfig = {
    mode: "fixed",
    penetration,
    notes: "User-defined local training value."
  };
  resolvePenetration(candidate, 1, 0);
  return candidate;
}

function parseCustomRules(query: SearchQuery): {
  readonly rules: GameRules;
  readonly penetration: PenetrationConfig;
  readonly shuffleMode: ShuffleMode;
  readonly deviationProfileId?: string;
} {
  const rules: GameRules = {
    decks: Number(first(query.rulesDecks)) as GameRules["decks"],
    blackjackPayout: first(query.rulesPayout) as GameRules["blackjackPayout"],
    dealerSoft17: first(query.rulesSoft17) as GameRules["dealerSoft17"],
    doubleRule: first(query.rulesDouble) as GameRules["doubleRule"],
    doubleAfterSplit: boolean(query.rulesDas),
    surrender: first(query.rulesSurrender) as GameRules["surrender"],
    maxSplitHands: Number(first(query.rulesMaxSplit)),
    resplitAces: boolean(query.rulesRsa),
    hitSplitAces: boolean(query.rulesHsa),
    doubleSplitAces: boolean(query.rulesDsa),
    dealerPeek: boolean(query.rulesPeek),
    burnCard: boolean(query.rulesBurn)
  };
  assertValidGameRules(rules);
  const shuffle = first(query.shuffle);
  const shuffleMode: ShuffleMode =
    shuffle === "perfect_random"
      ? "perfect"
      : ["automatic", "simulated_hand", "continuous"].includes(shuffle ?? "")
        ? (shuffle as ShuffleMode)
        : "perfect";
  const requestedProfile = first(query.deviationProfile);
  let deviationProfileId: string | undefined;
  if (requestedProfile === "basic-strategy-only") {
    deviationProfileId = requestedProfile;
  } else if (requestedProfile !== undefined) {
    deviationProfileId = getDeviationProfile(requestedProfile).id;
  }
  return {
    rules,
    penetration: parsePenetration(query),
    shuffleMode,
    ...(deviationProfileId === undefined ? {} : { deviationProfileId })
  };
}

function parseMode(
  value: string | readonly string[] | undefined
): TrainingMode {
  const candidate = first(value);
  return ["play", "observation", "practice", "decision"].includes(
    candidate ?? ""
  )
    ? (candidate as TrainingMode)
    : "observation";
}

function parseIntent(
  value: string | readonly string[] | undefined
): TrainingSkill {
  const candidate = first(value);
  if (candidate === "deviations") return "deviation";
  return [
    "basic_strategy",
    "running_count",
    "deck_estimation",
    "true_count",
    "deviation",
    "discipline",
    "full_game"
  ].includes(candidate ?? "")
    ? (candidate as TrainingSkill)
    : "full_game";
}

export function parseSessionQuery(query: SearchQuery): ParsedSessionQuery {
  const presetId = first(query.preset) ?? "";
  const preset = getPreset(presetId);
  let gameRules = preset?.rules ?? DEFAULT_SESSION_CONFIG.rules;
  let penetration = preset?.penetration ?? DEFAULT_SESSION_CONFIG.penetration;
  let shuffleMode: ShuffleMode = "perfect";
  let deviationProfileId =
    preset?.deviationSetId ?? DEFAULT_SESSION_CONFIG.deviationProfileId;
  let presetLabel =
    preset === undefined ? "Custom rules" : `${preset.venue} ${preset.name}`;

  if (preset === undefined && presetId.startsWith("custom-")) {
    try {
      const custom = parseCustomRules(query);
      gameRules = custom.rules;
      penetration = custom.penetration;
      shuffleMode = custom.shuffleMode;
      deviationProfileId = custom.deviationProfileId;
      presetLabel = (first(query.customName) ?? "Custom rules").slice(0, 80);
    } catch {
      presetLabel = "Invalid custom profile, safe defaults loaded";
    }
  }
  deviationProfileId = resolveDeviationProfileForRules(
    gameRules,
    deviationProfileId
  );

  const tableMinimumCents = dollars(
    query.minBet,
    catalogTableMinimumCents(presetId) ?? 500,
    1_000_000
  );
  const startingBankrollCents = dollars(
    query.bankroll,
    DEFAULT_SESSION_CONFIG.limits.startingBankrollCents
  );
  const maxBetCents = Math.min(
    startingBankrollCents,
    Math.max(
      tableMinimumCents,
      dollars(query.maxBet, DEFAULT_SESSION_CONFIG.limits.maxBetCents)
    )
  );
  const maxLossCents = Math.min(
    startingBankrollCents,
    dollars(query.stopLoss, DEFAULT_SESSION_CONFIG.limits.maxLossCents)
  );
  const hands = boundedInteger(query.hands, 100, 1, 100_000);
  const minutes = boundedInteger(query.minutes, 60, 1, 1_440);
  const rules = { ...gameRules, penetration };
  const requestedIntent = parseIntent(query.intent);
  const practiceIntent =
    deviationProfileId === "basic-strategy-only" &&
    requestedIntent === "deviation"
      ? "basic_strategy"
      : requestedIntent;

  return {
    config: {
      seed: readSeed(query.seed as string | string[] | undefined),
      ...(presetId === "" ? {} : { presetId }),
      rules,
      penetration,
      shuffleMode,
      ...(deviationProfileId === undefined ? {} : { deviationProfileId }),
      limits: {
        startingBankrollCents,
        maxBetCents,
        maxLossCents,
        winStopCents: dollars(
          query.winStop,
          DEFAULT_SESSION_CONFIG.limits.winStopCents
        ),
        handLimit: hands,
        maxHands: hands,
        maxDurationSeconds: minutes * 60
      },
      count: parseCountSettings(query),
      practiceIntent
    },
    mode: parseMode(query.mode),
    presetLabel,
    tableMinimumCents
  };
}
