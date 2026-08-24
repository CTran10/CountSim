import { dealerShouldHit, evaluateHand, resolveOutcome } from "./blackjack";
import {
  calculateTrueCount,
  hiLoValue,
  type DeckEstimation,
  type TrueCountResolution
} from "./counting";
import { isValidSeed, shuffleDeterministically } from "./rng";
import { drawCard, createShoe, type Shoe } from "./shoe";
import {
  assertValidGameRules,
  blackjackProfit,
  canDoubleHand as rulesAllowDouble,
  isExactWager
} from "./rules";
import type {
  Card,
  GameRules,
  Outcome,
  PenetrationConfig,
  Rank,
  ShuffleMode
} from "./types";

export type BlackjackAction =
  "hit" | "stand" | "double" | "split" | "surrender" | "insurance";

const ROUND_POINT_BUDGET = 4 * 20 + 16;
const ROUND_TERMINAL_DRAWS = 5;

function cardsRequiredToGuaranteeRound(shoe: Shoe): number {
  // Maximize cards under four player totals below 21 plus a dealer below 17,
  // then reserve one terminal draw for each hand from the shoe's real ranks.
  const decks = shoe.cards.length / 52;
  const inventory = [
    ...Array.from({ length: 9 }, (_, index) => ({
      value: index + 1,
      count: 4 * decks
    })),
    { value: 10, count: 16 * decks }
  ];
  let pointsRemaining = ROUND_POINT_BUDGET;
  let cards = 0;
  for (const rank of inventory) {
    const usable = Math.min(
      rank.count,
      Math.floor(pointsRemaining / rank.value)
    );
    cards += usable;
    pointsRemaining -= usable * rank.value;
  }
  return Math.min(shoe.cards.length, cards + ROUND_TERMINAL_DRAWS);
}

export interface SessionRules extends GameRules {
  readonly penetration: PenetrationConfig;
}

export interface SessionLimits {
  readonly startingBankrollCents: number;
  readonly maxBetCents: number;
  readonly maxLossCents: number;
  readonly winStopCents: number;
  readonly handLimit: number;
  readonly maxHands?: number;
  readonly maxDurationSeconds?: number;
}

export interface CountSettings {
  readonly estimation: DeckEstimation;
  readonly resolution: TrueCountResolution;
}

export interface SessionConfig {
  readonly seed: number;
  readonly rules: SessionRules;
  readonly limits: SessionLimits;
  readonly count: CountSettings;
  readonly penetration: PenetrationConfig;
  readonly shuffleMode: ShuffleMode;
  readonly presetId?: string;
  readonly deviationProfileId?: string;
  readonly practiceIntent?: TrainingSkill;
}

export type TrainingSkill =
  | "basic_strategy"
  | "running_count"
  | "deck_estimation"
  | "true_count"
  | "deviation"
  | "discipline"
  | "full_game";

export const DEFAULT_SESSION_CONFIG: SessionConfig = Object.freeze({
  seed: 785390425,
  rules: Object.freeze({
    decks: 6,
    penetration: Object.freeze({ mode: "fixed", penetration: 0.75 }),
    blackjackPayout: "3:2",
    dealerSoft17: "H17",
    doubleRule: "any_two",
    doubleAfterSplit: true,
    surrender: "none",
    maxSplitHands: 4,
    resplitAces: true,
    hitSplitAces: false,
    doubleSplitAces: false,
    dealerPeek: true,
    burnCard: false
  }),
  penetration: Object.freeze({ mode: "fixed", penetration: 0.75 }),
  shuffleMode: "perfect",
  limits: Object.freeze({
    startingBankrollCents: 30_000,
    maxBetCents: 5_000,
    maxLossCents: 15_000,
    winStopCents: 25_000,
    handLimit: 100,
    maxHands: 100,
    maxDurationSeconds: 3_600
  }),
  count: Object.freeze({
    estimation: "half",
    resolution: "truncate"
  }),
  deviationProfileId: "hi-lo-shoe-h17",
  practiceIntent: "full_game"
});

export type SessionPhase =
  "betting" | "insurance" | "player" | "settled" | "stopped";

export type SessionCommand =
  | { readonly type: "place_bet"; readonly amountCents: number }
  | { readonly type: "deal" }
  | { readonly type: "hit" }
  | { readonly type: "stand" }
  | { readonly type: "double" }
  | { readonly type: "split" }
  | { readonly type: "surrender" }
  | { readonly type: "insurance"; readonly amountCents?: number }
  | { readonly type: "decline_insurance" }
  | {
      readonly type: "tighten_limits";
      readonly limits: Partial<
        Pick<
          SessionLimits,
          | "maxBetCents"
          | "maxLossCents"
          | "winStopCents"
          | "maxHands"
          | "maxDurationSeconds"
        >
      >;
    }
  | { readonly type: "advance_time"; readonly seconds: number }
  | { readonly type: "submit_count"; readonly value: number }
  | { readonly type: "submit_deck_estimate"; readonly value: number }
  | { readonly type: "submit_true_count"; readonly value: number };

export interface HandResult {
  readonly outcome: Outcome;
  readonly profitCents: number;
  readonly wagerCents: number;
  readonly message: string;
}

export interface TrainingAttempt {
  readonly skill: TrainingSkill;
  readonly expected: number | string;
  readonly submitted: number | string;
  readonly error: number | null;
  readonly correct: boolean;
  readonly handNumber: number;
}

export interface PlayerHandState {
  readonly id: string;
  readonly cards: readonly Card[];
  readonly wagerCents: number;
  readonly fromSplitAces: boolean;
  readonly fromSplit: boolean;
  readonly finished: boolean;
  readonly surrendered: boolean;
  readonly doubled: boolean;
  readonly result: HandResult | null;
}

export interface RoundResult {
  readonly outcome: Outcome;
  readonly profitCents: number;
  readonly wagerCents: number;
  readonly message: string;
  readonly hands: readonly HandResult[];
  readonly insuranceProfitCents: number;
}

export interface RoundState {
  readonly handNumber: number;
  readonly wagerCents: number;
  readonly playerHands: readonly PlayerHandState[];
  readonly activeHandIndex: number;
  readonly dealerCards: readonly Card[];
  readonly dealerHoleRevealed: boolean;
  readonly openingResolved: boolean;
  readonly insuranceCents: number;
  readonly insurance: {
    readonly wagerCents: number;
    readonly profitCents: number;
    readonly outcome: "pending" | "win" | "loss" | "declined";
  };
  readonly result: RoundResult | null;
}

export type SessionEvent =
  | {
      readonly sequence: number;
      readonly type: "shoe_shuffled";
      readonly shoeNumber: number;
      readonly cutIndex: number;
    }
  | {
      readonly sequence: number;
      readonly type: "wager_placed";
      readonly amountCents: number;
    }
  | {
      readonly sequence: number;
      readonly type: "card_exposed";
      readonly card: Card;
      readonly source: "player" | "dealer_up" | "dealer_hole" | "dealer_draw";
    }
  | {
      readonly sequence: number;
      readonly type: "player_action";
      readonly action: BlackjackAction;
      readonly handIndex: number;
    }
  | {
      readonly sequence: number;
      readonly type: "training_attempt";
      readonly attempt: TrainingAttempt;
    }
  | {
      readonly sequence: number;
      readonly type: "round_settled";
      readonly result: RoundResult;
      readonly bankrollCents: number;
    }
  | {
      readonly sequence: number;
      readonly type: "session_stopped";
      readonly reason: TerminalReason;
    };

type EventWithoutSequence = SessionEvent extends infer Event
  ? Event extends { readonly sequence: number }
    ? Omit<Event, "sequence">
    : never
  : never;

export interface ResolvedShoe {
  readonly number: number;
  readonly order: readonly string[];
  readonly cutIndex: number;
  readonly penetration: number;
  readonly shuffleMode: ShuffleMode;
}

export type TerminalReason =
  | "maximum_loss"
  | "win_stop"
  | "hand_limit"
  | "maximum_hands"
  | "maximum_duration"
  | "bankroll_depleted";

export interface SessionAnalytics {
  handsPlayed: number;
  strategyMistakes: number;
  countAttempts: number;
  countCorrect: number;
  deckAttempts: number;
  deckCorrect: number;
  trueCountAttempts: number;
  trueCountCorrect: number;
  disciplineViolations: number;
}

export interface SessionState {
  readonly config: SessionConfig;
  readonly phase: SessionPhase;
  readonly bankrollCents: number;
  readonly pendingBetCents: number;
  readonly round: RoundState | null;
  readonly shoe: Shoe;
  readonly shufflePending: boolean;
  readonly runningCount: number;
  readonly cardsSeen: number;
  readonly exposedCardIds: readonly string[];
  readonly continuousDiscard: readonly Card[];
  readonly successfulCommands: readonly SessionCommand[];
  readonly events: readonly SessionEvent[];
  readonly resolvedShoes: readonly ResolvedShoe[];
  readonly terminalReason: TerminalReason | null;
  readonly analytics: SessionAnalytics;
  readonly elapsedSeconds: number;
  readonly stopAfterRoundReason: TerminalReason | null;
}

interface SessionDraft {
  config: SessionConfig;
  phase: SessionPhase;
  bankrollCents: number;
  pendingBetCents: number;
  round: RoundState | null;
  shoe: Shoe;
  shufflePending: boolean;
  runningCount: number;
  cardsSeen: number;
  exposedCardIds: string[];
  continuousDiscard: Card[];
  successfulCommands: SessionCommand[];
  events: SessionEvent[];
  resolvedShoes: ResolvedShoe[];
  terminalReason: TerminalReason | null;
  analytics: SessionAnalytics;
  elapsedSeconds: number;
  stopAfterRoundReason: TerminalReason | null;
}

export interface CommandResult {
  readonly ok: boolean;
  readonly state: SessionState;
  readonly error?: string;
  readonly events: readonly SessionEvent[];
}

export interface TableView {
  readonly phase: SessionPhase;
  readonly bankrollCents: number;
  readonly pendingBetCents: number;
  readonly playerCards: readonly Card[];
  readonly dealerCards: readonly (Card | null)[];
  readonly playerHands: readonly PlayerHandState[];
  readonly activeHandIndex: number;
  readonly playerHand: ReturnType<typeof evaluateHand> | null;
  readonly dealerHand: ReturnType<typeof evaluateHand> | null;
  readonly result: RoundResult | null;
  readonly count: ReturnType<typeof calculateTrueCount> & {
    readonly runningCount: number;
    readonly cardsSeen: number;
    readonly lastExposedCard: Card | null;
    readonly lastCardCountValue: -1 | 0 | 1 | null;
  };
  readonly countSettings: CountSettings;
  readonly shoe: {
    readonly number: number;
    readonly cardsRemaining: number;
    readonly cardsDealt: number;
    readonly cutIndex: number;
    readonly cutReached: boolean;
    readonly shufflePending: boolean;
    readonly penetration: number;
    readonly shuffleMode: ShuffleMode;
  };
  readonly rules: SessionRules;
  readonly deviationProfileId: string | null;
  readonly limits: SessionLimits;
  readonly analytics: SessionAnalytics;
  readonly canPlaceBet: boolean;
  readonly canDeal: boolean;
  readonly canHit: boolean;
  readonly canStand: boolean;
  readonly canDouble: boolean;
  readonly canSplit: boolean;
  readonly canSurrender: boolean;
  readonly canInsure: boolean;
  readonly canDeclineInsurance: boolean;
  readonly trainingAvailable: {
    readonly runningCount: boolean;
    readonly deckEstimation: boolean;
    readonly trueCount: boolean;
  };
  readonly terminalReason: TerminalReason | null;
}

function copyPenetrationConfig(
  penetration: PenetrationConfig
): PenetrationConfig {
  if (penetration.mode !== "observed_distribution") {
    return Object.freeze({ ...penetration });
  }
  return Object.freeze({
    ...penetration,
    observations: Object.freeze(
      penetration.observations.map((observation) =>
        Object.freeze({ ...observation })
      )
    )
  });
}

function copyConfig(config: SessionConfig): SessionConfig {
  const penetration = copyPenetrationConfig(config.penetration);
  let copied: SessionConfig = {
    seed: config.seed,
    rules: Object.freeze({
      ...config.rules,
      penetration
    }),
    limits: Object.freeze({ ...config.limits }),
    count: Object.freeze({ ...config.count }),
    penetration,
    shuffleMode: config.shuffleMode
  };
  if (config.presetId !== undefined) {
    copied = { ...copied, presetId: config.presetId };
  }
  if (config.deviationProfileId !== undefined) {
    copied = { ...copied, deviationProfileId: config.deviationProfileId };
  }
  if (config.practiceIntent !== undefined) {
    copied = { ...copied, practiceIntent: config.practiceIntent };
  }
  return Object.freeze(copied);
}

function validateConfig(config: SessionConfig): void {
  if (!isValidSeed(config.seed)) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  assertValidGameRules(config.rules);
  const { startingBankrollCents, maxBetCents, maxLossCents, winStopCents } =
    config.limits;
  if (
    !Number.isInteger(startingBankrollCents) ||
    startingBankrollCents <= 0 ||
    !Number.isInteger(maxBetCents) ||
    maxBetCents <= 0 ||
    maxBetCents > startingBankrollCents ||
    !Number.isInteger(maxLossCents) ||
    maxLossCents <= 0 ||
    maxLossCents > startingBankrollCents ||
    !Number.isInteger(winStopCents) ||
    winStopCents < 0 ||
    !Number.isInteger(config.limits.maxHands ?? config.limits.handLimit) ||
    (config.limits.maxHands ?? config.limits.handLimit) <= 0 ||
    (config.limits.maxDurationSeconds !== undefined &&
      (!Number.isInteger(config.limits.maxDurationSeconds) ||
        config.limits.maxDurationSeconds <= 0))
  ) {
    throw new Error(
      "Session limits must be positive whole cents within the bankroll."
    );
  }
  if (
    !["exact", "half", "quarter", "whole"].includes(config.count.estimation) ||
    !["truncate", "floor", "nearest"].includes(config.count.resolution)
  ) {
    throw new Error("The counting projection settings are not supported.");
  }
  if (
    config.deviationProfileId !== undefined &&
    (config.deviationProfileId.trim() === "" ||
      config.deviationProfileId.length > 100)
  ) {
    throw new Error("Deviation profile ids must be non-empty and bounded.");
  }
}

function resolvedShoe(shoe: Shoe): ResolvedShoe {
  return {
    number: shoe.number,
    order: shoe.cards.map((card) => card.id),
    cutIndex: shoe.cutIndex,
    penetration: shoe.penetration,
    shuffleMode: shoe.shuffleMode
  };
}

function appendEvent(
  draft: SessionDraft,
  event: EventWithoutSequence
): SessionEvent {
  const sequenced = {
    ...event,
    sequence: draft.events.length
  } as SessionEvent;
  draft.events.push(sequenced);
  return sequenced;
}

export function createSession(config: SessionConfig): SessionState {
  const normalizedConfig: SessionConfig = {
    ...DEFAULT_SESSION_CONFIG,
    ...config,
    rules: {
      ...DEFAULT_SESSION_CONFIG.rules,
      ...config.rules,
      penetration: config.penetration ?? config.rules.penetration
    },
    limits: {
      ...DEFAULT_SESSION_CONFIG.limits,
      ...config.limits,
      handLimit: config.limits.maxHands ?? config.limits.handLimit
    },
    count: { ...DEFAULT_SESSION_CONFIG.count, ...config.count }
  };
  validateConfig(normalizedConfig);
  const safeConfig = copyConfig(normalizedConfig);
  const shoe = createShoe({
    decks: safeConfig.rules.decks,
    penetration: safeConfig.rules.penetration,
    seed: safeConfig.seed,
    shoeNumber: 0,
    shuffleMode: safeConfig.shuffleMode ?? "perfect"
  });
  const state: SessionDraft = {
    config: safeConfig,
    phase: "betting",
    bankrollCents: safeConfig.limits.startingBankrollCents,
    pendingBetCents: 0,
    round: null,
    shoe,
    shufflePending: false,
    runningCount: 0,
    cardsSeen: 0,
    exposedCardIds: [],
    continuousDiscard: [],
    successfulCommands: [],
    events: [],
    resolvedShoes: [resolvedShoe(shoe)],
    terminalReason: null,
    analytics: {
      handsPlayed: 0,
      strategyMistakes: 0,
      countAttempts: 0,
      countCorrect: 0,
      deckAttempts: 0,
      deckCorrect: 0,
      trueCountAttempts: 0,
      trueCountCorrect: 0,
      disciplineViolations: 0
    },
    elapsedSeconds: 0,
    stopAfterRoundReason: null
  };
  appendEvent(state, {
    type: "shoe_shuffled",
    shoeNumber: 0,
    cutIndex: shoe.cutIndex
  });
  if (safeConfig.rules.burnCard) takeCard(state);
  return state;
}

function cloneState(state: SessionState): SessionDraft {
  return {
    ...state,
    successfulCommands: [...state.successfulCommands],
    events: [...state.events],
    exposedCardIds: [...state.exposedCardIds],
    continuousDiscard: [...state.continuousDiscard],
    resolvedShoes: [...state.resolvedShoes],
    analytics: { ...state.analytics },
    stopAfterRoundReason: state.stopAfterRoundReason
  };
}

function reject(state: SessionState, error: string): CommandResult {
  return { ok: false, state, error, events: [] };
}

function exposeCard(
  draft: SessionDraft,
  card: Card,
  source: Extract<SessionEvent, { type: "card_exposed" }>["source"]
): void {
  if (draft.exposedCardIds.includes(card.id)) return;
  draft.exposedCardIds.push(card.id);
  draft.runningCount += hiLoValue(card);
  draft.cardsSeen += 1;
  appendEvent(draft, { type: "card_exposed", card, source });
}

function takeCard(
  draft: SessionDraft,
  exposedAs?: Extract<SessionEvent, { type: "card_exposed" }>["source"]
): Card {
  const drawn = drawCard(draft.shoe);
  draft.shoe = drawn.shoe;
  if (exposedAs !== undefined) exposeCard(draft, drawn.card, exposedAs);
  return drawn.card;
}

function revealHoleCard(draft: SessionDraft): void {
  const round = draft.round;
  const hole = round?.dealerCards[1];
  if (round === null || round === undefined || hole === undefined) return;
  exposeCard(draft, hole, "dealer_hole");
  draft.round = { ...round, dealerHoleRevealed: true };
}

function activeHand(round: RoundState): PlayerHandState {
  return round.playerHands[round.activeHandIndex] ?? round.playerHands[0]!;
}

function replaceHand(
  round: RoundState,
  index: number,
  hand: PlayerHandState
): RoundState {
  return {
    ...round,
    playerHands: round.playerHands.map((candidate, candidateIndex) =>
      candidateIndex === index ? hand : candidate
    )
  };
}

function nextUnfinishedIndex(round: RoundState): number {
  return round.playerHands.findIndex((hand) => !hand.finished);
}

function advanceHand(draft: SessionDraft): void {
  const round = draft.round;
  if (round === null) return;
  const nextIndex = nextUnfinishedIndex(round);
  if (nextIndex >= 0) {
    draft.round = { ...round, activeHandIndex: nextIndex };
    return;
  }
  playDealerAndSettle(draft);
}

function resultMessage(outcome: Outcome): string {
  if (outcome === "blackjack") return "Blackjack paid.";
  if (outcome === "win") return "Player wins the hand.";
  if (outcome === "push") return "Push. The wager is returned.";
  if (outcome === "surrender") return "Surrender returned half.";
  return "Dealer wins the hand.";
}

function handResult(
  hand: PlayerHandState,
  dealerCards: readonly Card[],
  rules: SessionRules
): HandResult {
  if (hand.surrendered) {
    return {
      outcome: "surrender",
      profitCents: -hand.wagerCents / 2,
      wagerCents: hand.wagerCents,
      message: resultMessage("surrender")
    };
  }
  const outcome = resolveOutcome(hand.cards, dealerCards, {
    playerNaturalEligible: !hand.fromSplit
  });
  const naturalBlackjack = outcome === "blackjack";
  const profitCents = naturalBlackjack
    ? blackjackProfit(hand.wagerCents, rules.blackjackPayout)
    : outcome === "win"
      ? hand.wagerCents
      : outcome === "loss"
        ? -hand.wagerCents
        : 0;
  const resolvedOutcome = naturalBlackjack ? "blackjack" : outcome;
  return {
    outcome: resolvedOutcome,
    profitCents,
    wagerCents: hand.wagerCents,
    message: resultMessage(resolvedOutcome)
  };
}

function summaryOutcome(
  results: readonly HandResult[],
  insuranceProfitCents: number
): Outcome {
  if (insuranceProfitCents !== 0) {
    const total =
      insuranceProfitCents +
      results.reduce((sum, result) => sum + result.profitCents, 0);
    if (total > 0) return "win";
    if (total < 0) return "loss";
    return "push";
  }
  if (results.length === 1 && results[0]?.outcome === "blackjack")
    return "blackjack";
  if (results.length === 1 && results[0]?.outcome === "surrender")
    return "surrender";
  if (new Set(results.map((result) => result.outcome)).size > 1) return "mixed";
  const profit = results.reduce((sum, result) => sum + result.profitCents, 0);
  if (profit > 0) return "win";
  if (profit < 0) return "loss";
  return "push";
}

function stopIfNeeded(draft: SessionDraft): void {
  const realizedLoss =
    draft.config.limits.startingBankrollCents - draft.bankrollCents;
  const realizedWin =
    draft.bankrollCents - draft.config.limits.startingBankrollCents;
  const handLimit =
    draft.config.limits.maxHands ?? draft.config.limits.handLimit;
  let reason: TerminalReason | null = null;
  if (draft.bankrollCents <= 0) reason = "bankroll_depleted";
  else if (realizedLoss >= draft.config.limits.maxLossCents)
    reason = "maximum_loss";
  else if (
    draft.config.limits.winStopCents > 0 &&
    realizedWin >= draft.config.limits.winStopCents
  )
    reason = "win_stop";
  else if (draft.analytics.handsPlayed >= handLimit) reason = "maximum_hands";
  else if (
    draft.config.limits.maxDurationSeconds !== undefined &&
    draft.elapsedSeconds >= draft.config.limits.maxDurationSeconds
  )
    reason = "maximum_duration";

  if (draft.stopAfterRoundReason !== null) {
    reason = draft.stopAfterRoundReason;
    draft.stopAfterRoundReason = null;
  }

  if (reason !== null) {
    if (draft.phase === "player" || draft.phase === "insurance") {
      draft.stopAfterRoundReason = reason;
      return;
    }
    draft.phase = "stopped";
    draft.terminalReason = reason;
    appendEvent(draft, { type: "session_stopped", reason });
  }
}

function settleRound(draft: SessionDraft): void {
  if (draft.round === null)
    throw new Error("Cannot settle without an active round.");
  revealHoleCard(draft);
  const round = draft.round!;
  const dealerBlackjack = evaluateHand(round.dealerCards).blackjack;
  const insuranceProfitCents =
    round.insuranceCents > 0
      ? dealerBlackjack
        ? round.insuranceCents * 2
        : -round.insuranceCents
      : 0;
  const insurance =
    round.insuranceCents === 0
      ? round.insurance
      : {
          wagerCents: round.insuranceCents,
          profitCents: insuranceProfitCents,
          outcome: dealerBlackjack ? ("win" as const) : ("loss" as const)
        };
  const hands = round.playerHands.map((hand) =>
    handResult(hand, round.dealerCards, draft.config.rules)
  );
  const handProfit = hands.reduce((sum, hand) => sum + hand.profitCents, 0);
  const result: RoundResult = {
    outcome: summaryOutcome(hands, insuranceProfitCents),
    profitCents: handProfit + insuranceProfitCents,
    wagerCents: hands.reduce((sum, hand) => sum + hand.wagerCents, 0),
    message:
      hands.length > 1
        ? `Resolved ${hands.length} split hands.`
        : (hands[0]?.message ?? "Round complete."),
    hands,
    insuranceProfitCents
  };
  draft.bankrollCents += result.profitCents;
  draft.pendingBetCents = 0;
  draft.round = {
    ...round,
    insurance,
    playerHands: round.playerHands.map((hand, index) => ({
      ...hand,
      finished: true,
      result: hands[index] ?? null
    })),
    result
  };
  draft.shufflePending =
    draft.config.shuffleMode === "continuous" ||
    draft.shoe.nextIndex >= draft.shoe.cutIndex;
  draft.phase = "settled";
  draft.analytics.handsPlayed += 1;
  appendEvent(draft, {
    type: "round_settled",
    result,
    bankrollCents: draft.bankrollCents
  });
  stopIfNeeded(draft);
}

function playDealer(draft: SessionDraft): void {
  revealHoleCard(draft);
  let round = draft.round;
  if (round === null) throw new Error("Dealer cannot play without a round.");

  while (
    dealerShouldHit(
      round.dealerCards,
      draft.config.rules.dealerSoft17 === "H17"
    )
  ) {
    const card = takeCard(draft, "dealer_draw");
    round = { ...round, dealerCards: [...round.dealerCards, card] };
    draft.round = round;
  }
}

function playDealerAndSettle(draft: SessionDraft): void {
  const round = draft.round;
  if (round === null) return;
  const allPlayerBustOrSurrender = round.playerHands.every(
    (hand) => evaluateHand(hand.cards).bust || hand.surrendered
  );
  if (!allPlayerBustOrSurrender) playDealer(draft);
  else revealHoleCard(draft);
  settleRound(draft);
}

function prepareNextShoe(draft: SessionDraft): void {
  if (!draft.shufflePending) return;
  const shoeNumber = draft.shoe.number + 1;
  let shoe: Shoe;
  if (draft.config.shuffleMode === "continuous") {
    const available = draft.shoe.cards.slice(draft.shoe.nextIndex);
    const discarded = shuffleDeterministically(
      [
        ...draft.continuousDiscard,
        ...draft.shoe.cards.slice(0, draft.shoe.nextIndex)
      ],
      (draft.config.seed ^ 0xc5c5_c5c5) >>> 0,
      shoeNumber
    );
    const minimumReturn = Math.max(0, 24 - available.length);
    const returnCount = Math.min(
      discarded.length,
      Math.max(minimumReturn, Math.ceil(discarded.length * 0.35))
    );
    const cards = shuffleDeterministically(
      [...available, ...discarded.slice(0, returnCount)],
      (draft.config.seed ^ 0x3c3c_3c3c) >>> 0,
      shoeNumber + 101
    );
    draft.continuousDiscard = discarded.slice(returnCount);
    shoe = {
      cards,
      cutIndex: Math.max(1, Math.floor(cards.length * draft.shoe.penetration)),
      nextIndex: 0,
      number: shoeNumber,
      penetration: draft.shoe.penetration,
      shuffleMode: "continuous"
    };
  } else {
    shoe = createShoe({
      decks: draft.config.rules.decks,
      penetration: draft.config.rules.penetration,
      seed: draft.config.seed,
      shoeNumber,
      shuffleMode: draft.config.shuffleMode ?? "perfect"
    });
    draft.continuousDiscard = [];
  }
  draft.shoe = shoe;
  draft.shufflePending = false;
  draft.runningCount = 0;
  draft.cardsSeen = 0;
  draft.exposedCardIds = [];
  draft.resolvedShoes.push(resolvedShoe(shoe));
  appendEvent(draft, {
    type: "shoe_shuffled",
    shoeNumber,
    cutIndex: shoe.cutIndex
  });
  if (draft.config.rules.burnCard) takeCard(draft);
}

function availableCash(state: SessionState | SessionDraft): number {
  const round = state.round;
  const liveWagers =
    round?.playerHands.reduce((sum, hand) => sum + hand.wagerCents, 0) ?? 0;
  return state.bankrollCents - liveWagers - (round?.insuranceCents ?? 0);
}

function handlePlaceBet(
  state: SessionState,
  command: Extract<SessionCommand, { type: "place_bet" }>
): CommandResult | SessionDraft {
  if (state.phase === "player" || state.phase === "insurance") {
    return reject(state, "A wager can only be placed between rounds.");
  }
  if (state.phase === "stopped") {
    return reject(state, "A locked session limit has stopped this session.");
  }
  if (!Number.isInteger(command.amountCents) || command.amountCents <= 0) {
    return reject(state, "The wager must be a positive whole-cent amount.");
  }
  if (command.amountCents > state.config.limits.maxBetCents) {
    return reject(state, "The wager exceeds this session's maximum bet.");
  }
  if (!isExactWager(command.amountCents, state.config.rules.blackjackPayout)) {
    return reject(
      state,
      `The wager must support an exact ${state.config.rules.blackjackPayout} payout and surrender in whole cents.`
    );
  }
  if (command.amountCents > state.bankrollCents) {
    return reject(state, "The wager exceeds the virtual practice bankroll.");
  }

  const draft = cloneState(state);
  draft.phase = "betting";
  draft.pendingBetCents = command.amountCents;
  draft.round = null;
  appendEvent(draft, {
    type: "wager_placed",
    amountCents: command.amountCents
  });
  return draft;
}

function handleDeal(state: SessionState): CommandResult | SessionDraft {
  if (state.phase !== "betting" && state.phase !== "settled") {
    return reject(state, "Deal is only available between rounds.");
  }
  if (state.pendingBetCents <= 0) {
    return reject(state, "Place a wager before dealing.");
  }
  const draft = cloneState(state);
  if (
    draft.shoe.cards.length - draft.shoe.nextIndex <
    cardsRequiredToGuaranteeRound(draft.shoe)
  ) {
    draft.shufflePending = true;
  }
  prepareNextShoe(draft);
  const playerFirst = takeCard(draft, "player");
  const dealerUp = takeCard(draft, "dealer_up");
  const playerSecond = takeCard(draft, "player");
  const dealerHole = takeCard(draft);
  draft.round = {
    handNumber: draft.analytics.handsPlayed + 1,
    wagerCents: draft.pendingBetCents,
    playerHands: [
      {
        id: `hand-${draft.analytics.handsPlayed + 1}`,
        cards: [playerFirst, playerSecond],
        wagerCents: draft.pendingBetCents,
        fromSplitAces: false,
        fromSplit: false,
        finished: false,
        surrendered: false,
        doubled: false,
        result: null
      }
    ],
    activeHandIndex: 0,
    dealerCards: [dealerUp, dealerHole],
    dealerHoleRevealed: false,
    openingResolved: false,
    insuranceCents: 0,
    insurance: {
      wagerCents: 0,
      profitCents: 0,
      outcome: "pending"
    },
    result: null
  };
  draft.phase = dealerUp.rank === "A" ? "insurance" : "player";

  const playerValue = evaluateHand(draft.round.playerHands[0]!.cards);
  const dealerValue = evaluateHand(draft.round.dealerCards);
  const dealerPeekRank = dealerUp.rank === "A" || hiLoValue(dealerUp) === -1;
  const deferForEarlySurrender =
    draft.config.rules.surrender === "early" && dealerPeekRank;
  if (draft.phase !== "insurance" && !deferForEarlySurrender) {
    draft.round = { ...draft.round, openingResolved: true };
    if (
      draft.config.rules.dealerPeek &&
      dealerPeekRank &&
      dealerValue.blackjack
    ) {
      settleRound(draft);
    } else if (playerValue.blackjack) {
      settleRound(draft);
    }
  }
  return draft;
}

function finishActiveHand(
  draft: SessionDraft,
  transform: (hand: PlayerHandState) => PlayerHandState,
  action: BlackjackAction
): void {
  const round = draft.round;
  if (round === null) return;
  const index = round.activeHandIndex;
  draft.round = replaceHand(round, index, transform(activeHand(round)));
  appendEvent(draft, { type: "player_action", action, handIndex: index });
  advanceHand(draft);
}

function resolveDeferredOpening(state: SessionState): SessionState {
  if (
    state.phase !== "player" ||
    state.round === null ||
    state.round.openingResolved
  ) {
    return state;
  }
  const draft = cloneState(state);
  draft.round = { ...draft.round!, openingResolved: true };
  if (
    draft.config.rules.dealerPeek &&
    evaluateHand(draft.round.dealerCards).blackjack
  ) {
    settleRound(draft);
  }
  return draft;
}

function handleHit(state: SessionState): CommandResult | SessionDraft {
  const beforeOpening = state;
  state = resolveDeferredOpening(state);
  if (
    state !== beforeOpening &&
    state.phase === "settled" &&
    state.round?.result !== null
  ) {
    return cloneState(state);
  }
  if (state.phase !== "player" || state.round === null) {
    return reject(state, "Hit is only available during the player turn.");
  }
  const hand = activeHand(state.round);
  if (evaluateHand(hand.cards).total >= 21) {
    return reject(state, "Hit is not available on a completed total.");
  }
  if (hand.fromSplitAces && !state.config.rules.hitSplitAces) {
    return reject(state, "This ruleset does not allow hitting split aces.");
  }
  const draft = cloneState(state);
  const card = takeCard(draft, "player");
  const round = draft.round!;
  const index = round.activeHandIndex;
  const nextHand = {
    ...activeHand(round),
    cards: [...activeHand(round).cards, card]
  };
  const nextValue = evaluateHand(nextHand.cards);
  draft.round = replaceHand(round, index, {
    ...nextHand,
    finished: nextValue.total >= 21
  });
  appendEvent(draft, {
    type: "player_action",
    action: "hit",
    handIndex: index
  });
  if (nextValue.total >= 21) advanceHand(draft);
  return draft;
}

function handleStand(state: SessionState): CommandResult | SessionDraft {
  const beforeOpening = state;
  state = resolveDeferredOpening(state);
  if (
    state !== beforeOpening &&
    state.phase === "settled" &&
    state.round?.result !== null
  ) {
    return cloneState(state);
  }
  if (state.phase !== "player" || state.round === null) {
    return reject(state, "Stand is only available during the player turn.");
  }
  const draft = cloneState(state);
  finishActiveHand(draft, (hand) => ({ ...hand, finished: true }), "stand");
  return draft;
}

function canDoubleHand(
  hand: PlayerHandState,
  rules: SessionRules,
  splitHandCount: number
): boolean {
  if (hand.cards.length !== 2 || hand.doubled || hand.surrendered) return false;
  return rulesAllowDouble(hand.cards, rules, {
    fromSplit: splitHandCount > 1 || hand.fromSplit,
    splitAces: hand.fromSplitAces
  });
}

function handleDouble(state: SessionState): CommandResult | SessionDraft {
  const beforeOpening = state;
  state = resolveDeferredOpening(state);
  if (
    state !== beforeOpening &&
    state.phase === "settled" &&
    state.round?.result !== null
  ) {
    return cloneState(state);
  }
  if (state.phase !== "player" || state.round === null) {
    return reject(state, "Double is only available during the player turn.");
  }
  const hand = activeHand(state.round);
  if (
    !canDoubleHand(hand, state.config.rules, state.round.playerHands.length)
  ) {
    return reject(state, "Double is not available for this hand.");
  }
  if (hand.wagerCents > availableCash(state)) {
    return reject(state, "The virtual bankroll cannot cover the double.");
  }
  if (hand.wagerCents * 2 > state.config.limits.maxBetCents) {
    return reject(state, "The double would exceed the locked maximum bet.");
  }
  const draft = cloneState(state);
  const card = takeCard(draft, "player");
  const round = draft.round!;
  const index = round.activeHandIndex;
  draft.round = replaceHand(round, index, {
    ...activeHand(round),
    cards: [...activeHand(round).cards, card],
    wagerCents: activeHand(round).wagerCents * 2,
    doubled: true,
    finished: true
  });
  appendEvent(draft, {
    type: "player_action",
    action: "double",
    handIndex: index
  });
  advanceHand(draft);
  return draft;
}

function canSplitHand(
  hand: PlayerHandState,
  round: RoundState,
  rules: SessionRules
) {
  if (hand.cards.length !== 2) return false;
  if (round.playerHands.length >= rules.maxSplitHands) return false;
  if (
    evaluateHand([hand.cards[0]!]).total !==
    evaluateHand([hand.cards[1]!]).total
  )
    return false;
  if (hand.cards[0]?.rank === "A" && hand.fromSplitAces && !rules.resplitAces)
    return false;
  return true;
}

function handleSplit(state: SessionState): CommandResult | SessionDraft {
  const beforeOpening = state;
  state = resolveDeferredOpening(state);
  if (
    state !== beforeOpening &&
    state.phase === "settled" &&
    state.round?.result !== null
  ) {
    return cloneState(state);
  }
  if (state.phase !== "player" || state.round === null) {
    return reject(state, "Split is only available during the player turn.");
  }
  const hand = activeHand(state.round);
  if (!canSplitHand(hand, state.round, state.config.rules)) {
    return reject(state, "Split is not available for this hand.");
  }
  if (hand.wagerCents > availableCash(state)) {
    return reject(state, "The virtual bankroll cannot cover the split.");
  }
  const draft = cloneState(state);
  const round = draft.round!;
  const firstCard = takeCard(draft, "player");
  const secondCard = takeCard(draft, "player");
  const splitAces = hand.cards[0]?.rank === "A";
  const canResplitFirstAce =
    splitAces &&
    firstCard.rank === "A" &&
    draft.config.rules.resplitAces &&
    round.playerHands.length + 1 < draft.config.rules.maxSplitHands;
  const canResplitSecondAce =
    splitAces &&
    secondCard.rank === "A" &&
    draft.config.rules.resplitAces &&
    round.playerHands.length + 1 < draft.config.rules.maxSplitHands;
  const canDoubleFirstSplitAce =
    splitAces &&
    rulesAllowDouble([hand.cards[0]!, firstCard], draft.config.rules, {
      fromSplit: true,
      splitAces: true
    });
  const canDoubleSecondSplitAce =
    splitAces &&
    rulesAllowDouble([hand.cards[1]!, secondCard], draft.config.rules, {
      fromSplit: true,
      splitAces: true
    });
  const firstHand: PlayerHandState = {
    ...hand,
    id: `${hand.id}-split-a`,
    cards: [hand.cards[0]!, firstCard],
    fromSplitAces: splitAces,
    fromSplit: true,
    finished:
      evaluateHand([hand.cards[0]!, firstCard], {
        naturalEligible: false
      }).total >= 21 ||
      (splitAces &&
        !draft.config.rules.hitSplitAces &&
        !canResplitFirstAce &&
        !canDoubleFirstSplitAce)
  };
  const secondHand: PlayerHandState = {
    ...hand,
    id: `${hand.id}-split-b`,
    cards: [hand.cards[1]!, secondCard],
    fromSplitAces: splitAces,
    fromSplit: true,
    finished:
      evaluateHand([hand.cards[1]!, secondCard], {
        naturalEligible: false
      }).total >= 21 ||
      (splitAces &&
        !draft.config.rules.hitSplitAces &&
        !canResplitSecondAce &&
        !canDoubleSecondSplitAce)
  };
  let expandedHands: readonly PlayerHandState[] = [
    ...round.playerHands.slice(0, round.activeHandIndex),
    firstHand,
    secondHand,
    ...round.playerHands.slice(round.activeHandIndex + 1)
  ];
  if (
    expandedHands.length >= draft.config.rules.maxSplitHands &&
    !draft.config.rules.hitSplitAces &&
    !draft.config.rules.doubleSplitAces
  ) {
    expandedHands = expandedHands.map((candidate) =>
      candidate.fromSplitAces &&
      candidate.cards[0]?.rank === "A" &&
      candidate.cards[1]?.rank === "A"
        ? { ...candidate, finished: true }
        : candidate
    );
  }
  draft.round = {
    ...round,
    playerHands: expandedHands,
    activeHandIndex:
      firstHand.finished && !secondHand.finished
        ? round.activeHandIndex + 1
        : round.activeHandIndex
  };
  appendEvent(draft, {
    type: "player_action",
    action: "split",
    handIndex: round.activeHandIndex
  });
  if (activeHand(draft.round).finished) advanceHand(draft);
  return draft;
}

function handleSurrender(state: SessionState): CommandResult | SessionDraft {
  const early = state.config.rules.surrender === "early";
  if (
    state.round === null ||
    (state.phase !== "player" && !(early && state.phase === "insurance"))
  ) {
    return reject(state, "Surrender is only available during the player turn.");
  }
  if (state.config.rules.surrender === "none") {
    return reject(state, "This ruleset does not offer surrender.");
  }
  const hand = activeHand(state.round);
  if (hand.cards.length !== 2 || state.round.playerHands.length > 1) {
    return reject(
      state,
      "Surrender is only available on the original two cards."
    );
  }
  if (
    state.config.rules.surrender === "late" &&
    evaluateHand(state.round.dealerCards).blackjack
  ) {
    const draft = cloneState(state);
    draft.round = { ...draft.round!, openingResolved: true };
    settleRound(draft);
    return draft;
  }
  const draft = cloneState(state);
  if (draft.phase === "insurance") {
    draft.phase = "player";
    draft.round = {
      ...draft.round!,
      openingResolved: true,
      insurance: { wagerCents: 0, profitCents: 0, outcome: "declined" }
    };
  }
  finishActiveHand(
    draft,
    (candidate) => ({
      ...candidate,
      surrendered: true,
      finished: true
    }),
    "surrender"
  );
  return draft;
}

function handleInsurance(
  state: SessionState,
  command: Extract<SessionCommand, { type: "insurance" }>
): CommandResult | SessionDraft {
  if (state.phase !== "insurance" || state.round === null) {
    return reject(state, "Insurance is only available after the deal.");
  }
  if (state.round.dealerCards[0]?.rank !== "A") {
    return reject(state, "Insurance is only offered against a dealer ace.");
  }
  if (state.round.insuranceCents > 0) {
    return reject(state, "Insurance has already been placed for this round.");
  }
  const maxInsurance = Math.floor(state.round.wagerCents / 2);
  const amountCents = command.amountCents ?? maxInsurance;
  if (
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > maxInsurance
  ) {
    return reject(state, "Insurance must be no more than half the wager.");
  }
  if (amountCents > availableCash(state)) {
    return reject(state, "The virtual bankroll cannot cover insurance.");
  }
  const draft = cloneState(state);
  draft.round = {
    ...draft.round!,
    openingResolved: true,
    insuranceCents: amountCents,
    insurance: { wagerCents: amountCents, profitCents: 0, outcome: "pending" }
  };
  appendEvent(draft, {
    type: "player_action",
    action: "insurance",
    handIndex: draft.round.activeHandIndex
  });
  const dealerBlackjack = evaluateHand(draft.round.dealerCards).blackjack;
  const playerBlackjack = evaluateHand(
    draft.round.playerHands[0]!.cards
  ).blackjack;
  if ((draft.config.rules.dealerPeek && dealerBlackjack) || playerBlackjack)
    settleRound(draft);
  else draft.phase = "player";
  return draft;
}

function handleDeclineInsurance(
  state: SessionState
): CommandResult | SessionDraft {
  if (state.phase !== "insurance" || state.round === null) {
    return reject(state, "Insurance can only be declined when offered.");
  }
  const draft = cloneState(state);
  draft.round = {
    ...draft.round!,
    openingResolved: true,
    insurance: { wagerCents: 0, profitCents: 0, outcome: "declined" }
  };
  const dealerBlackjack = evaluateHand(draft.round.dealerCards).blackjack;
  const playerBlackjack = evaluateHand(
    draft.round.playerHands[0]!.cards
  ).blackjack;
  if ((draft.config.rules.dealerPeek && dealerBlackjack) || playerBlackjack)
    settleRound(draft);
  else draft.phase = "player";
  return draft;
}

function trainingSnapshot(state: SessionState) {
  const cardsRemaining = state.shoe.cards.length - state.shoe.nextIndex;
  return calculateTrueCount({
    runningCount: state.runningCount,
    cardsRemaining,
    estimation: state.config.count.estimation,
    resolution: state.config.count.resolution
  });
}

function trainingAttemptAvailable(
  state: SessionState,
  skill: TrainingAttempt["skill"]
): boolean {
  if (state.phase === "stopped" || state.cardsSeen === 0) return false;
  let lastExposureIndex = -1;
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    if (state.events[index]?.type === "card_exposed") {
      lastExposureIndex = index;
      break;
    }
  }
  if (lastExposureIndex < 0) return false;
  return !state.events
    .slice(lastExposureIndex + 1)
    .some(
      (event) =>
        event.type === "training_attempt" && event.attempt.skill === skill
    );
}

function handleTrainingAttempt(
  state: SessionState,
  command:
    | Extract<SessionCommand, { type: "submit_count" }>
    | Extract<SessionCommand, { type: "submit_deck_estimate" }>
    | Extract<SessionCommand, { type: "submit_true_count" }>
): CommandResult | SessionDraft {
  const skill =
    command.type === "submit_count"
      ? "running_count"
      : command.type === "submit_deck_estimate"
        ? "deck_estimation"
        : "true_count";
  if (!trainingAttemptAvailable(state, skill)) {
    return reject(
      state,
      "Wait for newly exposed cards before submitting another answer."
    );
  }
  if (!Number.isFinite(command.value)) {
    return reject(state, "Training answers must be finite numbers.");
  }
  if (
    (command.type === "submit_count" || command.type === "submit_true_count") &&
    !Number.isInteger(command.value)
  ) {
    return reject(state, "Count answers must be whole numbers.");
  }
  if (command.type === "submit_deck_estimate" && command.value < 0) {
    return reject(state, "Deck estimates must be non-negative.");
  }
  const draft = cloneState(state);
  const snapshot = trainingSnapshot(state);
  const handNumber = state.round?.handNumber ?? state.analytics.handsPlayed + 1;
  let attempt: TrainingAttempt;
  if (command.type === "submit_count") {
    const error = command.value - state.runningCount;
    attempt = {
      skill: "running_count",
      expected: state.runningCount,
      submitted: command.value,
      error,
      correct: error === 0,
      handNumber
    };
    draft.analytics.countAttempts += 1;
    if (attempt.correct) draft.analytics.countCorrect += 1;
  } else if (command.type === "submit_deck_estimate") {
    const error = command.value - snapshot.decksRemainingEstimated;
    attempt = {
      skill: "deck_estimation",
      expected: snapshot.decksRemainingEstimated,
      submitted: command.value,
      error,
      correct: Math.abs(error) <= 0.25,
      handNumber
    };
    draft.analytics.deckAttempts += 1;
    if (attempt.correct) draft.analytics.deckCorrect += 1;
  } else {
    const error = command.value - snapshot.trueCountResolved;
    attempt = {
      skill: "true_count",
      expected: snapshot.trueCountResolved,
      submitted: command.value,
      error,
      correct: error === 0,
      handNumber
    };
    draft.analytics.trueCountAttempts += 1;
    if (attempt.correct) draft.analytics.trueCountCorrect += 1;
  }
  appendEvent(draft, { type: "training_attempt", attempt });
  return draft;
}

function handleTightenLimits(
  state: SessionState,
  command: Extract<SessionCommand, { type: "tighten_limits" }>
): CommandResult | SessionDraft {
  if (state.phase === "stopped") {
    return reject(state, "A locked session limit has stopped this session.");
  }
  const current = state.config.limits;
  const next = { ...current };
  if (
    command.limits.maxBetCents !== undefined &&
    state.pendingBetCents > command.limits.maxBetCents
  ) {
    return reject(
      state,
      "Locked maximum bet cannot undercut the pending wager."
    );
  }
  if (
    command.limits.maxBetCents !== undefined &&
    Number.isInteger(command.limits.maxBetCents) &&
    command.limits.maxBetCents > 0 &&
    command.limits.maxBetCents <= current.maxBetCents
  )
    next.maxBetCents = command.limits.maxBetCents;
  else if (command.limits.maxBetCents !== undefined)
    return reject(state, "Locked maximum bet cannot be increased.");

  if (
    command.limits.maxLossCents !== undefined &&
    Number.isInteger(command.limits.maxLossCents) &&
    command.limits.maxLossCents > 0 &&
    command.limits.maxLossCents <= current.maxLossCents
  )
    next.maxLossCents = command.limits.maxLossCents;
  else if (command.limits.maxLossCents !== undefined)
    return reject(state, "Locked stop-loss cannot be loosened.");

  if (
    command.limits.winStopCents !== undefined &&
    Number.isInteger(command.limits.winStopCents) &&
    command.limits.winStopCents > 0 &&
    (current.winStopCents === 0 ||
      command.limits.winStopCents <= current.winStopCents)
  )
    next.winStopCents = command.limits.winStopCents;
  else if (command.limits.winStopCents !== undefined)
    return reject(state, "Locked win stop cannot be loosened.");

  if (
    command.limits.maxHands !== undefined &&
    Number.isInteger(command.limits.maxHands) &&
    command.limits.maxHands > 0 &&
    command.limits.maxHands <= (current.maxHands ?? current.handLimit)
  ) {
    next.maxHands = command.limits.maxHands;
    next.handLimit = command.limits.maxHands;
  } else if (command.limits.maxHands !== undefined)
    return reject(state, "Locked hand limit cannot be increased.");

  if (
    command.limits.maxDurationSeconds !== undefined &&
    Number.isInteger(command.limits.maxDurationSeconds) &&
    command.limits.maxDurationSeconds > 0 &&
    command.limits.maxDurationSeconds <=
      (current.maxDurationSeconds ?? Number.POSITIVE_INFINITY)
  )
    next.maxDurationSeconds = command.limits.maxDurationSeconds;
  else if (command.limits.maxDurationSeconds !== undefined)
    return reject(state, "Locked duration cannot be increased.");

  const draft = cloneState(state);
  draft.config = { ...draft.config, limits: Object.freeze(next) };
  stopIfNeeded(draft);
  return draft;
}

function handleAdvanceTime(
  state: SessionState,
  command: Extract<SessionCommand, { type: "advance_time" }>
): CommandResult | SessionDraft {
  if (state.phase === "stopped") {
    return reject(state, "A locked session limit has stopped this session.");
  }
  if (!Number.isInteger(command.seconds) || command.seconds < 0) {
    return reject(state, "Elapsed seconds must be a non-negative integer.");
  }
  const draft = cloneState(state);
  draft.elapsedSeconds += command.seconds;
  const duration = draft.config.limits.maxDurationSeconds;
  if (duration !== undefined && draft.elapsedSeconds >= duration) {
    if (draft.phase === "player" || draft.phase === "insurance") {
      draft.stopAfterRoundReason = "maximum_duration";
    } else {
      draft.phase = "stopped";
      draft.terminalReason = "maximum_duration";
      appendEvent(draft, {
        type: "session_stopped",
        reason: "maximum_duration"
      });
    }
  }
  return draft;
}

function isCommandResult(
  value: CommandResult | SessionDraft
): value is CommandResult {
  return "ok" in value;
}

function copyAcceptedCommand(command: SessionCommand): SessionCommand {
  if (command.type === "tighten_limits") {
    return Object.freeze({
      type: command.type,
      limits: Object.freeze({ ...command.limits })
    });
  }
  return Object.freeze({ ...command });
}

export function applyCommand(
  state: SessionState,
  command: SessionCommand
): CommandResult {
  const beforeEventCount = state.events.length;
  let handled: CommandResult | SessionDraft;
  switch (command.type) {
    case "place_bet":
      handled = handlePlaceBet(state, command);
      break;
    case "deal":
      handled = handleDeal(state);
      break;
    case "hit":
      handled = handleHit(state);
      break;
    case "stand":
      handled = handleStand(state);
      break;
    case "double":
      handled = handleDouble(state);
      break;
    case "split":
      handled = handleSplit(state);
      break;
    case "surrender":
      handled = handleSurrender(state);
      break;
    case "insurance":
      handled = handleInsurance(state, command);
      break;
    case "decline_insurance":
      handled = handleDeclineInsurance(state);
      break;
    case "tighten_limits":
      handled = handleTightenLimits(state, command);
      break;
    case "advance_time":
      handled = handleAdvanceTime(state, command);
      break;
    case "submit_count":
    case "submit_deck_estimate":
    case "submit_true_count":
      handled = handleTrainingAttempt(state, command);
      break;
    default:
      return reject(state, "The command is not supported.");
  }

  if (isCommandResult(handled)) return handled;
  handled.successfulCommands.push(copyAcceptedCommand(command));
  return {
    ok: true,
    state: handled,
    events: handled.events.slice(beforeEventCount)
  };
}

export function selectTableView(state: SessionState): TableView {
  const round = state.round;
  const dealerCards =
    round === null
      ? []
      : round.dealerCards.map((card, index) =>
          index === 1 && !round.dealerHoleRevealed ? null : card
        );
  const cardsRemaining = state.shoe.cards.length - state.shoe.nextIndex;
  const count = calculateTrueCount({
    runningCount: state.runningCount,
    cardsRemaining,
    estimation: state.config.count.estimation,
    resolution: state.config.count.resolution
  });
  const playerHands = round?.playerHands ?? [];
  const currentHand = round === null ? null : activeHand(round);
  const lastExposure = [...state.events]
    .reverse()
    .find((event) => event.type === "card_exposed");

  return {
    phase: state.phase,
    bankrollCents: state.bankrollCents,
    pendingBetCents: state.pendingBetCents,
    playerCards: currentHand?.cards ?? [],
    dealerCards,
    playerHands,
    activeHandIndex: round?.activeHandIndex ?? 0,
    playerHand: currentHand === null ? null : evaluateHand(currentHand.cards),
    dealerHand:
      round === null || !round.dealerHoleRevealed
        ? null
        : evaluateHand(round.dealerCards),
    result: round?.result ?? null,
    count: {
      ...count,
      runningCount: state.runningCount,
      cardsSeen: state.cardsSeen,
      lastExposedCard: lastExposure?.card ?? null,
      lastCardCountValue:
        lastExposure === undefined ? null : hiLoValue(lastExposure.card)
    },
    countSettings: state.config.count,
    shoe: {
      number: state.shoe.number,
      cardsRemaining,
      cardsDealt: state.shoe.nextIndex,
      cutIndex: state.shoe.cutIndex,
      cutReached: state.shoe.nextIndex >= state.shoe.cutIndex,
      shufflePending: state.shufflePending,
      penetration: state.shoe.cutIndex / state.shoe.cards.length,
      shuffleMode: state.shoe.shuffleMode
    },
    rules: state.config.rules,
    deviationProfileId: state.config.deviationProfileId ?? null,
    limits: state.config.limits,
    analytics: state.analytics,
    canPlaceBet: state.phase === "betting" || state.phase === "settled",
    canDeal:
      (state.phase === "betting" || state.phase === "settled") &&
      state.pendingBetCents > 0,
    canHit:
      state.phase === "player" &&
      currentHand !== null &&
      evaluateHand(currentHand.cards).total < 21 &&
      !(currentHand.fromSplitAces && !state.config.rules.hitSplitAces),
    canStand: state.phase === "player",
    canDouble:
      state.phase === "player" &&
      currentHand !== null &&
      round !== null &&
      canDoubleHand(
        currentHand,
        state.config.rules,
        round.playerHands.length
      ) &&
      currentHand.wagerCents <= availableCash(state) &&
      currentHand.wagerCents * 2 <= state.config.limits.maxBetCents,
    canSplit:
      state.phase === "player" &&
      currentHand !== null &&
      round !== null &&
      canSplitHand(currentHand, round, state.config.rules) &&
      currentHand.wagerCents <= availableCash(state),
    canSurrender:
      (state.phase === "player" ||
        (state.phase === "insurance" &&
          state.config.rules.surrender === "early")) &&
      currentHand !== null &&
      round !== null &&
      state.config.rules.surrender !== "none" &&
      currentHand.cards.length === 2 &&
      round.playerHands.length === 1,
    canInsure:
      state.phase === "insurance" &&
      round !== null &&
      round.dealerCards[0]?.rank === ("A" as Rank) &&
      round.insuranceCents === 0 &&
      Math.floor(round.wagerCents / 2) > 0 &&
      availableCash(state) >= Math.floor(round.wagerCents / 2),
    canDeclineInsurance:
      state.phase === "insurance" &&
      round !== null &&
      round.insuranceCents === 0,
    trainingAvailable: {
      runningCount: trainingAttemptAvailable(state, "running_count"),
      deckEstimation: trainingAttemptAvailable(state, "deck_estimation"),
      trueCount: trainingAttemptAvailable(state, "true_count")
    },
    terminalReason: state.terminalReason
  };
}
