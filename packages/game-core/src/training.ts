import { projectExposedCards } from "./counting";
import {
  evaluateDeviation,
  type DeviationDecision,
  type DeviationProfile
} from "./deviations";
import { createSeededGenerator, isValidSeed } from "./rng";
import { recommendBasicStrategy, type StrategyDecision } from "./strategy";
import { RANKS, SUITS, type Card, type GameRules, type Rank } from "./types";

export type SkillId =
  | "running_count"
  | "deck_estimation"
  | "true_count"
  | "basic_strategy"
  | "deviations"
  | "insurance"
  | "penetration"
  | "full_table";

const SKILL_IDS: readonly SkillId[] = [
  "running_count",
  "deck_estimation",
  "true_count",
  "basic_strategy",
  "deviations",
  "insurance",
  "penetration",
  "full_table"
];

export interface SkillAttempt {
  readonly correct: boolean;
}

export interface TaggedSkillAttempt extends SkillAttempt {
  readonly skill: SkillId;
}

export interface SkillScore {
  readonly skill: SkillId;
  readonly attempts: number;
  readonly correct: number;
  readonly streak: number;
  readonly score: number;
}

export interface TrainingItem {
  readonly id: string;
  readonly skills: readonly SkillId[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface TrainingScheduleInput {
  readonly items: readonly TrainingItem[];
  readonly profile: readonly SkillScore[];
  readonly seed: number;
  readonly count: number;
}

export interface CountingDrillInput {
  readonly seed: number;
  readonly length: number;
  readonly startingCount?: number;
}

export interface CountingDrill {
  readonly id: string;
  readonly cards: readonly Card[];
  readonly startingCount: number;
  readonly expectedHistory: readonly number[];
  readonly finalRunningCount: number;
}

export type DecisionScenarioFocus = "basic_strategy" | "deviations" | "mixed";

export interface DecisionScenarioInput {
  readonly seed: number;
  readonly rules: GameRules;
  readonly profile: string | DeviationProfile;
  readonly focus?: DecisionScenarioFocus;
}

export interface DecisionScenario {
  readonly id: string;
  readonly focus: Exclude<DecisionScenarioFocus, "mixed">;
  readonly playerCards: readonly Card[];
  readonly dealerUpCard: Card;
  readonly trueCount: number;
  readonly prompt: string;
  readonly basicDecision: StrategyDecision;
  readonly deviationDecision: DeviationDecision;
}

interface ScenarioTemplate {
  readonly id: string;
  readonly player: readonly Rank[];
  readonly dealer: Rank;
  readonly trueCount: number;
}

const BASIC_SCENARIOS: readonly ScenarioTemplate[] = [
  { id: "hard-9-2", player: ["4", "5"], dealer: "2", trueCount: 0 },
  { id: "soft-19-6", player: ["A", "8"], dealer: "6", trueCount: 0 },
  { id: "pair-4-5", player: ["4", "4"], dealer: "5", trueCount: 0 },
  { id: "hard-16-7", player: ["10", "6"], dealer: "7", trueCount: -1 },
  { id: "soft-18-9", player: ["A", "7"], dealer: "9", trueCount: 1 },
  { id: "pair-8-a", player: ["8", "8"], dealer: "A", trueCount: 0 }
];

const DEVIATION_SCENARIOS: readonly ScenarioTemplate[] = [
  { id: "i18-16-10", player: ["10", "6"], dealer: "10", trueCount: 0 },
  { id: "i18-12-3", player: ["10", "2"], dealer: "3", trueCount: 2 },
  { id: "i18-11-a", player: ["6", "5"], dealer: "A", trueCount: -1 },
  { id: "i18-tt-6", player: ["10", "K"], dealer: "6", trueCount: 4 },
  { id: "fab4-15-9", player: ["10", "5"], dealer: "9", trueCount: 2 },
  { id: "fab4-15-a", player: ["9", "6"], dealer: "A", trueCount: -1 }
];

export function scoreSkill(
  skill: SkillId,
  attempts: readonly SkillAttempt[]
): SkillScore {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  let streak = 0;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index]!.correct) break;
    streak += 1;
  }

  if (attempts.length === 0) {
    return { skill, attempts: 0, correct: 0, streak: 0, score: 0 };
  }

  const accuracy = correct / attempts.length;
  const streakSignal = Math.min(streak / 5, 1);
  const evidence = Math.min(attempts.length / 10, 1);
  const score = Math.round(accuracy * 70 + streakSignal * 15 + evidence * 15);

  return {
    skill,
    attempts: attempts.length,
    correct,
    streak,
    score
  };
}

export function buildSkillProfile(
  attempts: readonly TaggedSkillAttempt[]
): readonly SkillScore[] {
  const order: SkillId[] = [];
  const grouped = new Map<SkillId, SkillAttempt[]>();

  for (const attempt of attempts) {
    const existing = grouped.get(attempt.skill);
    if (existing === undefined) {
      order.push(attempt.skill);
      grouped.set(attempt.skill, [{ correct: attempt.correct }]);
    } else {
      existing.push({ correct: attempt.correct });
    }
  }

  return order.map((skill) => scoreSkill(skill, grouped.get(skill)!));
}

function scoreForItem(
  item: TrainingItem,
  scores: ReadonlyMap<SkillId, number>
): number {
  if (item.skills.length === 0) return 0;
  const sum = item.skills.reduce(
    (total, skill) => total + (scores.get(skill) ?? 0),
    0
  );
  return sum / item.skills.length;
}

export function scheduleTrainingItems(
  input: TrainingScheduleInput
): readonly TrainingItem[] {
  if (!isValidSeed(input.seed)) {
    throw new Error("Training seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isInteger(input.count) || input.count < 0) {
    throw new Error("Training item count must be a non-negative integer.");
  }
  if (input.count > 0 && input.items.length === 0) {
    throw new Error("Cannot schedule training without items.");
  }

  const ids = new Set<string>();
  for (const item of input.items) {
    if (item.id.trim() === "" || ids.has(item.id)) {
      throw new Error("Training item ids must be non-empty and unique.");
    }
    if (item.skills.length === 0) {
      throw new Error("Training items require at least one skill.");
    }
    if (item.skills.some((skill) => !SKILL_IDS.includes(skill))) {
      throw new Error("Training items contain an unsupported skill.");
    }
    if (
      !Number.isInteger(item.difficulty) ||
      item.difficulty < 1 ||
      item.difficulty > 5
    ) {
      throw new Error("Training difficulty must be an integer from 1 to 5.");
    }
    ids.add(item.id);
  }

  for (const entry of input.profile) {
    if (
      !SKILL_IDS.includes(entry.skill) ||
      !Number.isInteger(entry.attempts) ||
      entry.attempts < 0 ||
      !Number.isInteger(entry.correct) ||
      entry.correct < 0 ||
      entry.correct > entry.attempts ||
      !Number.isInteger(entry.streak) ||
      entry.streak < 0 ||
      entry.streak > entry.correct ||
      !Number.isFinite(entry.score) ||
      entry.score < 0 ||
      entry.score > 100
    ) {
      throw new Error("Training profile contains an invalid skill score.");
    }
  }

  const scores = new Map(
    input.profile.map((entry) => [entry.skill, entry.score])
  );
  const initialRandom = createSeededGenerator(input.seed, 0);
  const initial = input.items
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      priority:
        (100 - scoreForItem(item, scores)) * 1_000 +
        item.difficulty * 10 +
        initialRandom()
    }))
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.originalIndex - right.originalIndex
    )
    .map((entry) => entry.item);
  const scheduled = initial.slice(0, input.count);

  for (let slot = scheduled.length; slot < input.count; slot += 1) {
    const weights = input.items.map(
      (item) => Math.max(1, 101 - scoreForItem(item, scores)) * item.difficulty
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = createSeededGenerator(input.seed, slot + 1)() * total;
    let selected = input.items.at(-1)!;
    for (let index = 0; index < input.items.length; index += 1) {
      cursor -= weights[index]!;
      if (cursor < 0) {
        selected = input.items[index]!;
        break;
      }
    }
    scheduled.push(selected);
  }

  return scheduled;
}

export function generateCountingDrill(
  input: CountingDrillInput
): CountingDrill {
  if (!isValidSeed(input.seed)) {
    throw new Error("Counting drill seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isInteger(input.length) || input.length <= 0) {
    throw new Error("Counting drill length must be a positive integer.");
  }
  if (input.length > 416) {
    throw new Error("Counting drills are limited to eight decks.");
  }

  const random = createSeededGenerator(input.seed, 41);
  const startingCount = input.startingCount ?? 0;
  const cards = Array.from({ length: input.length }, (_, index): Card => {
    const rank = RANKS[Math.floor(random() * RANKS.length)]!;
    const suit = SUITS[Math.floor(random() * SUITS.length)]!;
    return { id: `count-drill-${input.seed}-${index}-${rank}`, rank, suit };
  });
  const projection = projectExposedCards(cards, startingCount);

  return {
    id: `count-${input.seed}-${input.length}-${startingCount}`,
    cards,
    startingCount,
    expectedHistory: projection.history,
    finalRunningCount: projection.runningCount
  };
}

function scenarioCard(rank: Rank, id: string, suitIndex: number): Card {
  return { id, rank, suit: SUITS[suitIndex % SUITS.length]! };
}

export function generateDecisionScenario(
  input: DecisionScenarioInput
): DecisionScenario {
  if (!isValidSeed(input.seed)) {
    throw new Error(
      "Decision scenario seed must be an unsigned 32-bit integer."
    );
  }

  const requestedFocus = input.focus ?? "mixed";
  const random = createSeededGenerator(input.seed, 73);
  const focus =
    requestedFocus === "mixed"
      ? random() < 0.5
        ? "basic_strategy"
        : "deviations"
      : requestedFocus;
  const templates =
    focus === "basic_strategy" ? BASIC_SCENARIOS : DEVIATION_SCENARIOS;
  const template = templates[Math.floor(random() * templates.length)]!;
  const playerCards = template.player.map((rank, index) =>
    scenarioCard(rank, `${template.id}-player-${index}`, index)
  );
  const dealerUpCard = scenarioCard(
    template.dealer,
    `${template.id}-dealer`,
    playerCards.length
  );
  const strategyInput = {
    playerCards,
    dealerUpCard,
    rules: input.rules
  };
  const basicDecision = recommendBasicStrategy(strategyInput);
  const deviationDecision = evaluateDeviation({
    ...strategyInput,
    profile: input.profile,
    trueCount: template.trueCount
  });

  return {
    id: `${focus}-${input.seed}-${template.id}`,
    focus,
    playerCards,
    dealerUpCard,
    trueCount: template.trueCount,
    prompt: `Dealer shows ${template.dealer}. Player has ${template.player.join(" + ")}. True count ${template.trueCount}. Choose the correct action.`,
    basicDecision,
    deviationDecision
  };
}
