import { evaluateHand } from "./blackjack";
import type { BlackjackPayout, Card, DeckCount, GameRules } from "./types";

const SUPPORTED_DECKS: readonly DeckCount[] = [1, 2, 4, 6, 8];

export const DEFAULT_GAME_RULES: GameRules = Object.freeze({
  decks: 6,
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
});

export function assertValidGameRules(rules: GameRules): void {
  if (!SUPPORTED_DECKS.includes(rules.decks)) {
    throw new Error("Deck count must be 1, 2, 4, 6, or 8.");
  }
  if (rules.blackjackPayout !== "3:2" && rules.blackjackPayout !== "6:5") {
    throw new Error("Blackjack payout must be 3:2 or 6:5.");
  }
  if (rules.dealerSoft17 !== "H17" && rules.dealerSoft17 !== "S17") {
    throw new Error("Dealer soft 17 rule must be H17 or S17.");
  }
  if (!["any_two", "9_10_11", "10_11"].includes(rules.doubleRule)) {
    throw new Error("Double rule is not supported.");
  }
  if (!["none", "late", "early"].includes(rules.surrender)) {
    throw new Error("Surrender rule is not supported.");
  }
  if (
    !Number.isInteger(rules.maxSplitHands) ||
    rules.maxSplitHands < 2 ||
    rules.maxSplitHands > 4
  ) {
    throw new Error("Maximum split hands must be a whole number from 2 to 4.");
  }
}

export interface DoubleEligibility {
  readonly fromSplit?: boolean;
  readonly splitAces?: boolean;
}

export function canDoubleHand(
  cards: readonly Card[],
  rules: GameRules,
  eligibility: DoubleEligibility = {}
): boolean {
  if (cards.length !== 2) return false;
  if (eligibility.fromSplit && !rules.doubleAfterSplit) return false;
  if (eligibility.splitAces && !rules.doubleSplitAces) return false;
  const total = evaluateHand(cards).total;
  if (rules.doubleRule === "any_two") return true;
  if (rules.doubleRule === "9_10_11") return [9, 10, 11].includes(total);
  return total === 10 || total === 11;
}

export function blackjackProfit(
  wagerCents: number,
  payout: BlackjackPayout
): number {
  if (!Number.isInteger(wagerCents) || wagerCents <= 0) {
    throw new Error("Blackjack wager must be positive whole cents.");
  }
  const numerator = payout === "3:2" ? 3 : 6;
  const denominator = payout === "3:2" ? 2 : 5;
  const value = (wagerCents * numerator) / denominator;
  if (!Number.isInteger(value)) {
    throw new Error(`The wager does not support an exact payout at ${payout}.`);
  }
  return value;
}

export function isExactWager(
  wagerCents: number,
  payout: BlackjackPayout
): boolean {
  if (!Number.isInteger(wagerCents) || wagerCents <= 0) return false;
  // Surrender can return half a wager, so all accepted main wagers are even.
  if (wagerCents % 2 !== 0) return false;
  return Number.isInteger(
    (wagerCents * (payout === "3:2" ? 3 : 6)) / (payout === "3:2" ? 2 : 5)
  );
}
