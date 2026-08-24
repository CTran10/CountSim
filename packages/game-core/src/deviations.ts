import { evaluateHand } from "./blackjack";
import {
  getAvailableActions,
  recommendBasicStrategy,
  type PlayerAction,
  type StrategyDecisionInput
} from "./strategy";
import type { Card, DealerSoft17, GameRules, Rank } from "./types";

export type DeviationCategory = "illustrious18" | "fab4" | "custom";
export type DeviationDeckClass = "double_deck" | "shoe" | "custom";

export type DeviationMatch =
  | { readonly kind: "insurance" }
  | {
      readonly kind: "hard" | "soft";
      readonly total: number;
      readonly dealer: Rank;
    }
  | {
      readonly kind: "pair";
      readonly pairValue: Rank;
      readonly dealer: Rank;
    };

export interface DeviationEntry {
  readonly id: string;
  readonly label: string;
  readonly category: DeviationCategory;
  readonly rank: number;
  readonly match: DeviationMatch;
  readonly index: number;
  readonly action: PlayerAction;
  readonly belowIndexAction: PlayerAction | "decline";
  readonly requiresSurrender?: boolean;
  readonly explanation: string;
}

export interface DeviationProfile {
  readonly id: string;
  readonly label: string;
  readonly countSystem: "Hi-Lo" | string;
  readonly deckClass: DeviationDeckClass;
  readonly dealerSoft17: DealerSoft17;
  readonly doubleAfterSplit?: boolean;
  readonly resplitAces?: boolean;
  readonly entries: readonly DeviationEntry[];
}

export interface DeviationDecisionInput extends StrategyDecisionInput {
  readonly profile: string | DeviationProfile;
  readonly trueCount: number;
}

export interface DeviationDecision {
  readonly entry?: DeviationEntry;
  readonly opportunity: boolean;
  readonly eligible: boolean;
  readonly profileCompatible: boolean;
  readonly thresholdMet: boolean;
  readonly action: PlayerAction;
  readonly basicAction: PlayerAction;
  readonly explanation: string;
}

export interface InsuranceDeviationInput {
  readonly profile: string | DeviationProfile;
  readonly rules: GameRules;
  readonly trueCount: number;
}

export interface InsuranceDeviationDecision {
  readonly entry: DeviationEntry;
  readonly opportunity: true;
  readonly eligible: boolean;
  readonly profileCompatible: boolean;
  readonly thresholdMet: boolean;
  readonly action: "insurance" | "decline";
  readonly explanation: string;
}

const I18_H17: readonly DeviationEntry[] = [
  {
    id: "i18-insurance",
    label: "Insurance",
    category: "illustrious18",
    rank: 1,
    match: { kind: "insurance" },
    index: 3,
    action: "insurance",
    belowIndexAction: "decline",
    explanation:
      "At this count, remaining ten-value density makes insurance favorable."
  },
  {
    id: "i18-16-10",
    label: "16 vs 10",
    category: "illustrious18",
    rank: 2,
    match: { kind: "hard", total: 16, dealer: "10" },
    index: 0,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Stand when the true count reaches zero or higher."
  },
  {
    id: "i18-15-10",
    label: "15 vs 10",
    category: "illustrious18",
    rank: 3,
    match: { kind: "hard", total: 15, dealer: "10" },
    index: 4,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "A high ten density moves hard 15 from hit to stand."
  },
  {
    id: "i18-tt-5",
    label: "10,10 vs 5",
    category: "illustrious18",
    rank: 4,
    match: { kind: "pair", pairValue: "10", dealer: "5" },
    index: 5,
    action: "split",
    belowIndexAction: "stand",
    explanation: "Split the made 20 only at the high positive index."
  },
  {
    id: "i18-tt-6",
    label: "10,10 vs 6",
    category: "illustrious18",
    rank: 5,
    match: { kind: "pair", pairValue: "10", dealer: "6" },
    index: 4,
    action: "split",
    belowIndexAction: "stand",
    explanation: "A very rich shoe supports splitting tens against dealer 6."
  },
  {
    id: "i18-10-10",
    label: "10 vs 10",
    category: "illustrious18",
    rank: 6,
    match: { kind: "hard", total: 10, dealer: "10" },
    index: 4,
    action: "double",
    belowIndexAction: "hit",
    explanation: "Double hard 10 once the true count reaches the index."
  },
  {
    id: "i18-12-3",
    label: "12 vs 3",
    category: "illustrious18",
    rank: 7,
    match: { kind: "hard", total: 12, dealer: "3" },
    index: 2,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Stand when high cards make the dealer more likely to break."
  },
  {
    id: "i18-12-2",
    label: "12 vs 2",
    category: "illustrious18",
    rank: 8,
    match: { kind: "hard", total: 12, dealer: "2" },
    index: 3,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Hard 12 stands against 2 only at the positive index."
  },
  {
    id: "i18-11-a",
    label: "11 vs A",
    category: "illustrious18",
    rank: 9,
    match: { kind: "hard", total: 11, dealer: "A" },
    index: -1,
    action: "double",
    belowIndexAction: "hit",
    explanation: "H17 moves the 11 against ace crossover below zero."
  },
  {
    id: "i18-9-2",
    label: "9 vs 2",
    category: "illustrious18",
    rank: 10,
    match: { kind: "hard", total: 9, dealer: "2" },
    index: 1,
    action: "double",
    belowIndexAction: "hit",
    explanation: "Double hard 9 against 2 at a positive true count."
  },
  {
    id: "i18-10-a",
    label: "10 vs A",
    category: "illustrious18",
    rank: 11,
    match: { kind: "hard", total: 10, dealer: "A" },
    index: 3,
    action: "double",
    belowIndexAction: "hit",
    explanation: "Double hard 10 against ace only in a rich H17 shoe."
  },
  {
    id: "i18-9-7",
    label: "9 vs 7",
    category: "illustrious18",
    rank: 12,
    match: { kind: "hard", total: 9, dealer: "7" },
    index: 3,
    action: "double",
    belowIndexAction: "hit",
    explanation: "The positive index turns hard 9 against 7 into a double."
  },
  {
    id: "i18-16-9",
    label: "16 vs 9",
    category: "illustrious18",
    rank: 13,
    match: { kind: "hard", total: 16, dealer: "9" },
    index: 5,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Stand hard 16 against 9 only at a very high count."
  },
  {
    id: "i18-13-2",
    label: "13 vs 2",
    category: "illustrious18",
    rank: 14,
    match: { kind: "hard", total: 13, dealer: "2" },
    index: -1,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Stand from true count minus one upward."
  },
  {
    id: "i18-12-4",
    label: "12 vs 4",
    category: "illustrious18",
    rank: 15,
    match: { kind: "hard", total: 12, dealer: "4" },
    index: 0,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Hit below zero and stand from zero upward."
  },
  {
    id: "i18-12-5",
    label: "12 vs 5",
    category: "illustrious18",
    rank: 16,
    match: { kind: "hard", total: 12, dealer: "5" },
    index: -2,
    action: "stand",
    belowIndexAction: "hit",
    explanation:
      "The weak dealer supports standing down to true count minus two."
  },
  {
    id: "i18-12-6",
    label: "12 vs 6",
    category: "illustrious18",
    rank: 17,
    match: { kind: "hard", total: 12, dealer: "6" },
    index: -3,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "H17 supports standing hard 12 against 6 down to minus three."
  },
  {
    id: "i18-13-3",
    label: "13 vs 3",
    category: "illustrious18",
    rank: 18,
    match: { kind: "hard", total: 13, dealer: "3" },
    index: -2,
    action: "stand",
    belowIndexAction: "hit",
    explanation: "Stand hard 13 against 3 from minus two upward."
  }
];

const FAB4_H17: readonly DeviationEntry[] = [
  {
    id: "fab4-14-10",
    label: "14 vs 10 surrender",
    category: "fab4",
    rank: 1,
    match: { kind: "hard", total: 14, dealer: "10" },
    index: 3,
    action: "surrender",
    belowIndexAction: "hit",
    requiresSurrender: true,
    explanation: "Surrender hard 14 against 10 from true count three upward."
  },
  {
    id: "fab4-15-9",
    label: "15 vs 9 surrender",
    category: "fab4",
    rank: 2,
    match: { kind: "hard", total: 15, dealer: "9" },
    index: 2,
    action: "surrender",
    belowIndexAction: "hit",
    requiresSurrender: true,
    explanation: "Surrender hard 15 against 9 from true count two upward."
  },
  {
    id: "fab4-15-10",
    label: "15 vs 10 surrender",
    category: "fab4",
    rank: 3,
    match: { kind: "hard", total: 15, dealer: "10" },
    index: 0,
    action: "surrender",
    belowIndexAction: "hit",
    requiresSurrender: true,
    explanation: "Surrender hard 15 against 10 from zero upward."
  },
  {
    id: "fab4-15-a",
    label: "15 vs A surrender",
    category: "fab4",
    rank: 4,
    match: { kind: "hard", total: 15, dealer: "A" },
    index: -1,
    action: "surrender",
    belowIndexAction: "hit",
    requiresSurrender: true,
    explanation:
      "H17 moves the 15 against ace surrender crossover to minus one."
  }
];

function replaceIndices(
  entries: readonly DeviationEntry[],
  replacements: Readonly<Record<string, number>>
): readonly DeviationEntry[] {
  return entries.map((entry) =>
    replacements[entry.id] === undefined
      ? entry
      : { ...entry, index: replacements[entry.id]! }
  );
}

function createBuiltInProfile(
  id: string,
  label: string,
  deckClass: DeviationDeckClass,
  dealerSoft17: DealerSoft17,
  replacements: Readonly<Record<string, number>> = {},
  compatibility: Pick<DeviationProfile, "doubleAfterSplit" | "resplitAces"> = {}
): DeviationProfile {
  return createDeviationProfile({
    id,
    label,
    countSystem: "Hi-Lo",
    deckClass,
    dealerSoft17,
    ...compatibility,
    entries: [
      ...replaceIndices(I18_H17, replacements),
      ...replaceIndices(FAB4_H17, replacements)
    ]
  });
}

const BUILT_IN_PROFILES: readonly DeviationProfile[] = [
  createBuiltInProfile(
    "hi-lo-shoe-h17",
    "Hi-Lo shoe H17: Illustrious 18 + Fab 4",
    "shoe",
    "H17"
  ),
  createBuiltInProfile(
    "hi-lo-shoe-s17",
    "Hi-Lo shoe S17: Illustrious 18 + Fab 4",
    "shoe",
    "S17",
    {
      "i18-11-a": 1,
      "i18-10-a": 4,
      "i18-12-6": -1,
      "fab4-15-a": 1
    }
  ),
  createBuiltInProfile(
    "hi-lo-dd-h17",
    "Hi-Lo double-deck H17: Illustrious 18 + Fab 4",
    "double_deck",
    "H17",
    {
      "i18-12-3": 1,
      "i18-11-a": 0,
      "i18-12-6": -4,
      "i18-13-3": -3
    }
  ),
  createBuiltInProfile(
    "hilo-dd-h17-das",
    "Hi-Lo double-deck H17 DAS: Illustrious 18 + Fab 4",
    "double_deck",
    "H17",
    {
      "i18-12-3": 1,
      "i18-11-a": 0,
      "i18-12-6": -4,
      "i18-13-3": -3
    },
    { doubleAfterSplit: true }
  ),
  createBuiltInProfile(
    "hilo-dd-h17-no-das",
    "Hi-Lo double-deck H17 no DAS: Illustrious 18 + Fab 4",
    "double_deck",
    "H17",
    {
      "i18-12-3": 1,
      "i18-11-a": 0,
      "i18-12-6": -4,
      "i18-13-3": -3
    },
    { doubleAfterSplit: false }
  ),
  createBuiltInProfile(
    "hilo-dd-h17-das-rsa",
    "Hi-Lo double-deck H17 DAS RSA: Illustrious 18 + Fab 4",
    "double_deck",
    "H17",
    {
      "i18-12-3": 1,
      "i18-11-a": 0,
      "i18-12-6": -4,
      "i18-13-3": -3
    },
    { doubleAfterSplit: true, resplitAces: true }
  ),
  createBuiltInProfile(
    "hilo-6d-h17-das-rsa",
    "Hi-Lo shoe H17 DAS RSA: Illustrious 18 + Fab 4",
    "shoe",
    "H17",
    {},
    { doubleAfterSplit: true, resplitAces: true }
  ),
  createBuiltInProfile(
    "hilo-6d-h17-das",
    "Hi-Lo shoe H17 DAS: Illustrious 18 + Fab 4",
    "shoe",
    "H17",
    {},
    { doubleAfterSplit: true }
  )
];

export function createDeviationProfile(
  profile: DeviationProfile
): DeviationProfile {
  if (profile.id.trim() === "" || profile.label.trim() === "") {
    throw new Error("Deviation profiles require an id and label.");
  }
  if (profile.entries.length === 0) {
    throw new Error("A deviation profile requires at least one entry.");
  }

  const ids = new Set<string>();
  const entries = profile.entries.map((entry) => {
    if (entry.id.trim() === "" || ids.has(entry.id)) {
      throw new Error("Deviation entry ids must be non-empty and unique.");
    }
    if (!Number.isInteger(entry.index) || !Number.isInteger(entry.rank)) {
      throw new Error("Deviation indices and ranks must be integers.");
    }
    ids.add(entry.id);
    return Object.freeze({
      ...entry,
      match: Object.freeze({ ...entry.match })
    }) as DeviationEntry;
  });

  return Object.freeze({ ...profile, entries: Object.freeze(entries) });
}

export function listDeviationProfiles(): readonly DeviationProfile[] {
  return BUILT_IN_PROFILES;
}

export function getDeviationProfile(id: string): DeviationProfile {
  const profile = BUILT_IN_PROFILES.find((candidate) => candidate.id === id);
  if (profile === undefined) {
    throw new Error(`Unknown deviation profile: ${id}`);
  }
  return profile;
}

function resolveProfile(profile: string | DeviationProfile): DeviationProfile {
  return typeof profile === "string" ? getDeviationProfile(profile) : profile;
}

function normalizedRank(rank: Rank): Rank {
  return rank === "J" || rank === "Q" || rank === "K" ? "10" : rank;
}

function entryMatches(
  entry: DeviationEntry,
  cards: readonly Card[],
  dealerUpCard: Card,
  basicAction: PlayerAction
): boolean {
  if (entry.match.kind === "insurance") return false;
  if (
    normalizedRank(dealerUpCard.rank) !== normalizedRank(entry.match.dealer)
  ) {
    return false;
  }

  const hand = evaluateHand(cards);
  if (entry.match.kind === "hard") {
    if (
      cards.length === 2 &&
      normalizedRank(cards[0]!.rank) === normalizedRank(cards[1]!.rank) &&
      basicAction === "split"
    ) {
      return false;
    }
    return !hand.soft && hand.total === entry.match.total;
  }
  if (entry.match.kind === "soft") {
    return hand.soft && hand.total === entry.match.total;
  }
  if (entry.match.kind !== "pair" || cards.length !== 2) return false;
  return (
    normalizedRank(cards[0]!.rank) === normalizedRank(entry.match.pairValue) &&
    normalizedRank(cards[1]!.rank) === normalizedRank(entry.match.pairValue)
  );
}

function profileMatchesRules(
  profile: DeviationProfile,
  rules: GameRules
): boolean {
  if (profile.dealerSoft17 !== rules.dealerSoft17) return false;
  if (
    profile.doubleAfterSplit !== undefined &&
    profile.doubleAfterSplit !== rules.doubleAfterSplit
  ) {
    return false;
  }
  if (
    profile.resplitAces !== undefined &&
    profile.resplitAces !== rules.resplitAces
  ) {
    return false;
  }
  if (profile.deckClass === "double_deck") return rules.decks === 2;
  if (profile.deckClass === "shoe") return rules.decks >= 4;
  return true;
}

export function resolveDeviationProfileForRules(
  rules: GameRules,
  requestedProfile?: string | null
): string {
  if (requestedProfile === "basic-strategy-only") {
    return requestedProfile;
  }
  if (requestedProfile !== undefined && requestedProfile !== null) {
    try {
      const profile = getDeviationProfile(requestedProfile);
      return profileMatchesRules(profile, rules)
        ? profile.id
        : "basic-strategy-only";
    } catch {
      return "basic-strategy-only";
    }
  }
  if (
    rules.decks === 1 ||
    (rules.decks === 2 && rules.dealerSoft17 === "S17")
  ) {
    return "basic-strategy-only";
  }
  return rules.decks === 2
    ? "hi-lo-dd-h17"
    : rules.dealerSoft17 === "S17"
      ? "hi-lo-shoe-s17"
      : "hi-lo-shoe-h17";
}

function isEntryEligible(
  entry: DeviationEntry,
  availableActions: readonly PlayerAction[],
  basicAction: PlayerAction
): boolean {
  if (entry.requiresSurrender && !availableActions.includes("surrender")) {
    return false;
  }
  if (basicAction === "surrender" && entry.action !== "surrender") {
    return false;
  }
  return availableActions.includes(entry.action);
}

export function evaluateDeviation(
  input: DeviationDecisionInput
): DeviationDecision {
  if (!Number.isFinite(input.trueCount)) {
    throw new Error("True count must be finite.");
  }

  const profile = resolveProfile(input.profile);
  const basic = recommendBasicStrategy(input);
  const availableActions = getAvailableActions(input);
  const matches = profile.entries
    .filter((entry) =>
      entryMatches(entry, input.playerCards, input.dealerUpCard, basic.action)
    )
    .sort((left, right) => {
      const leftEligible = isEntryEligible(left, availableActions, basic.action)
        ? 0
        : 1;
      const rightEligible = isEntryEligible(
        right,
        availableActions,
        basic.action
      )
        ? 0
        : 1;
      if (leftEligible !== rightEligible) return leftEligible - rightEligible;
      if (left.category === "fab4" && right.category !== "fab4") return -1;
      if (right.category === "fab4" && left.category !== "fab4") return 1;
      return left.rank - right.rank;
    });
  const entry = matches[0];

  if (entry === undefined) {
    return {
      opportunity: false,
      eligible: false,
      profileCompatible: profileMatchesRules(profile, input.rules),
      thresholdMet: false,
      action: basic.action,
      basicAction: basic.action,
      explanation: "No deviation in this profile matches the current hand."
    };
  }

  const profileCompatible = profileMatchesRules(profile, input.rules);
  const eligible =
    profileCompatible && isEntryEligible(entry, availableActions, basic.action);
  const thresholdMet = input.trueCount >= entry.index;
  const indexedAction = thresholdMet ? entry.action : entry.belowIndexAction;
  const action =
    basic.action === "surrender" && indexedAction !== "surrender"
      ? basic.action
      : eligible &&
          indexedAction !== "decline" &&
          availableActions.includes(indexedAction)
        ? indexedAction
        : basic.action;

  return {
    entry,
    opportunity: true,
    eligible,
    profileCompatible,
    thresholdMet,
    action,
    basicAction: basic.action,
    explanation: !profileCompatible
      ? `The ${profile.label} profile does not match the selected table rules.`
      : !eligible
        ? `${entry.label} is recognized, but ${entry.action} is not available under these rules.`
        : `${entry.explanation} TC ${input.trueCount} is ${thresholdMet ? "at or above" : "below"} index ${entry.index}.`
  };
}

export function evaluateInsuranceDeviation(
  input: InsuranceDeviationInput
): InsuranceDeviationDecision {
  if (!Number.isFinite(input.trueCount)) {
    throw new Error("True count must be finite.");
  }
  const profile = resolveProfile(input.profile);
  const entry = profile.entries.find(
    (candidate) => candidate.match.kind === "insurance"
  );
  if (entry === undefined) {
    throw new Error("The selected profile does not define an insurance index.");
  }
  const profileCompatible = profileMatchesRules(profile, input.rules);
  const thresholdMet = input.trueCount >= entry.index;

  return {
    entry,
    opportunity: true,
    eligible: profileCompatible,
    profileCompatible,
    thresholdMet,
    action: profileCompatible && thresholdMet ? "insurance" : "decline",
    explanation: !profileCompatible
      ? `The ${profile.label} profile does not match the selected table rules.`
      : `${entry.explanation} TC ${input.trueCount} is ${thresholdMet ? "at or above" : "below"} index ${entry.index}.`
  };
}
