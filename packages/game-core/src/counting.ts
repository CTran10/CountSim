import type { Card, Rank } from "./types";

export type DeckEstimation = "exact" | "quarter" | "half" | "whole";
export type TrueCountResolution = "truncate" | "floor" | "nearest";

export interface TrueCountInput {
  readonly runningCount: number;
  readonly cardsRemaining: number;
  readonly estimation?: DeckEstimation;
  readonly resolution?: TrueCountResolution;
}

export interface TrueCountProjection {
  readonly decksRemainingExact: number;
  readonly decksRemainingEstimated: number;
  readonly trueCountRaw: number;
  readonly trueCountResolved: number;
}

const HI_LO: Readonly<Record<Rank, -1 | 0 | 1>> = {
  A: -1,
  "2": 1,
  "3": 1,
  "4": 1,
  "5": 1,
  "6": 1,
  "7": 0,
  "8": 0,
  "9": 0,
  "10": -1,
  J: -1,
  Q: -1,
  K: -1
};

export function hiLoValue(card: Card): -1 | 0 | 1 {
  return HI_LO[card.rank];
}

export function projectExposedCards(
  cards: readonly Card[],
  startingCount = 0
): { readonly runningCount: number; readonly history: readonly number[] } {
  let runningCount = startingCount;
  const history = cards.map((card) => {
    runningCount += hiLoValue(card);
    return runningCount;
  });
  return { runningCount, history };
}

function estimateDecks(value: number, estimation: DeckEstimation): number {
  if (estimation === "exact") return value;
  if (estimation === "whole") return Math.max(1, Math.round(value));
  if (estimation === "quarter")
    return Math.max(0.25, Math.round(value * 4) / 4);
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function resolveTrueCount(
  value: number,
  resolution: TrueCountResolution
): number {
  if (resolution === "floor") return Math.floor(value);
  if (resolution === "nearest") return Math.round(value);
  return Math.trunc(value);
}

export function calculateTrueCount(input: TrueCountInput): TrueCountProjection {
  if (!Number.isInteger(input.cardsRemaining) || input.cardsRemaining < 0) {
    throw new Error("Cards remaining must be a non-negative integer.");
  }

  const estimation = input.estimation ?? "half";
  const resolution = input.resolution ?? "truncate";
  const decksRemainingExact = input.cardsRemaining / 52;
  const decksRemainingEstimated = estimateDecks(
    decksRemainingExact,
    estimation
  );
  const denominator = Math.max(0.25, decksRemainingEstimated);
  const trueCountRaw = input.runningCount / denominator;

  return {
    decksRemainingExact,
    decksRemainingEstimated,
    trueCountRaw,
    trueCountResolved: resolveTrueCount(trueCountRaw, resolution)
  };
}
