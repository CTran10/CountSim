export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K"
] as const;

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  readonly id: string;
  readonly rank: Rank;
  readonly suit: Suit;
}

export type Outcome =
  "blackjack" | "win" | "push" | "loss" | "surrender" | "mixed";

export interface HandValue {
  readonly total: number;
  readonly soft: boolean;
  readonly blackjack: boolean;
  readonly bust: boolean;
}

export type DeckCount = 1 | 2 | 4 | 6 | 8;

export type BlackjackPayout = "3:2" | "6:5";
export type DealerSoft17 = "H17" | "S17";
export type DoubleRule = "any_two" | "9_10_11" | "10_11";
export type SurrenderRule = "none" | "late" | "early";
export type ShuffleMode =
  "perfect" | "automatic" | "simulated_hand" | "continuous";

export interface GameRules {
  readonly decks: DeckCount;
  readonly blackjackPayout: BlackjackPayout;
  readonly dealerSoft17: DealerSoft17;
  readonly doubleRule: DoubleRule;
  readonly doubleAfterSplit: boolean;
  readonly surrender: SurrenderRule;
  readonly maxSplitHands: number;
  readonly resplitAces: boolean;
  readonly hitSplitAces: boolean;
  readonly doubleSplitAces: boolean;
  readonly dealerPeek: boolean;
  readonly burnCard: boolean;
}

export type PenetrationConfidence = "low" | "medium" | "high";
export type PenetrationSourceType =
  "user" | "community" | "published" | "training_default";

export interface PenetrationObservation {
  readonly penetration: number;
  readonly decksCut?: number;
  readonly cardsCut?: number;
  readonly observedAt: string;
  readonly sourceType: PenetrationSourceType;
  readonly confidence: PenetrationConfidence;
  readonly notes?: string;
}

export type PenetrationConfig =
  | {
      readonly mode: "fixed";
      readonly penetration: number;
      readonly notes?: string;
    }
  | {
      readonly mode: "range";
      readonly minPenetration: number;
      readonly maxPenetration: number;
      readonly notes?: string;
    }
  | {
      readonly mode: "observed_distribution";
      readonly observations: readonly PenetrationObservation[];
      readonly fallbackPenetration: number;
      readonly notes?: string;
    };
