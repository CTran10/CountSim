import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAME_RULES,
  assertValidGameRules,
  blackjackProfit,
  canDoubleHand,
  type Card,
  type GameRules,
  type Rank
} from "../src/index";

function hand(...ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => ({
    id: `rules-${index}-${rank}`,
    rank,
    suit: "clubs"
  }));
}

describe("game rules", () => {
  it.each([1, 2, 4, 6, 8] as const)("accepts a %i-deck game", (decks) => {
    expect(() =>
      assertValidGameRules({ ...DEFAULT_GAME_RULES, decks })
    ).not.toThrow();
  });

  it.each([0, 3, 10])("rejects unsupported deck count %i", (decks) => {
    expect(() =>
      assertValidGameRules({
        ...DEFAULT_GAME_RULES,
        decks: decks as GameRules["decks"]
      })
    ).toThrow("Deck count");
  });

  it.each([1, 5])("requires two through four total split hands", (value) => {
    expect(() =>
      assertValidGameRules({ ...DEFAULT_GAME_RULES, maxSplitHands: value })
    ).toThrow("Maximum split hands");
  });

  it("applies every supported double restriction", () => {
    expect(
      canDoubleHand(hand("5", "3"), {
        ...DEFAULT_GAME_RULES,
        doubleRule: "any_two"
      })
    ).toBe(true);
    expect(
      canDoubleHand(hand("5", "4"), {
        ...DEFAULT_GAME_RULES,
        doubleRule: "9_10_11"
      })
    ).toBe(true);
    expect(
      canDoubleHand(hand("5", "4"), {
        ...DEFAULT_GAME_RULES,
        doubleRule: "10_11"
      })
    ).toBe(false);
    expect(
      canDoubleHand(hand("6", "4"), {
        ...DEFAULT_GAME_RULES,
        doubleRule: "10_11"
      })
    ).toBe(true);
  });

  it("honors DAS and split-ace double restrictions", () => {
    expect(
      canDoubleHand(hand("6", "5"), DEFAULT_GAME_RULES, {
        fromSplit: true
      })
    ).toBe(true);
    expect(
      canDoubleHand(
        hand("A", "10"),
        { ...DEFAULT_GAME_RULES, doubleSplitAces: false },
        { fromSplit: true, splitAces: true }
      )
    ).toBe(false);
    expect(
      canDoubleHand(
        hand("6", "5"),
        { ...DEFAULT_GAME_RULES, doubleAfterSplit: false },
        { fromSplit: true }
      )
    ).toBe(false);
  });

  it("settles both supported blackjack payouts in exact cents", () => {
    expect(blackjackProfit(1_000, "3:2")).toBe(1_500);
    expect(blackjackProfit(1_000, "6:5")).toBe(1_200);
    expect(() => blackjackProfit(501, "3:2")).toThrow("exact payout");
  });
});
