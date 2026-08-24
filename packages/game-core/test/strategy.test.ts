import { describe, expect, it } from "vitest";

import { getAvailableActions, recommendBasicStrategy } from "../src/strategy";
import type { Card, GameRules, Rank } from "../src/types";

const BASE_RULES: GameRules = {
  decks: 6,
  blackjackPayout: "3:2",
  dealerSoft17: "H17",
  doubleRule: "any_two",
  doubleAfterSplit: true,
  surrender: "late",
  maxSplitHands: 4,
  resplitAces: true,
  hitSplitAces: false,
  doubleSplitAces: false,
  dealerPeek: true,
  burnCard: false
};

function hand(...ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => ({
    id: `strategy-${index}-${rank}`,
    rank,
    suit: "spades"
  }));
}

function up(rank: Rank): Card {
  return hand(rank)[0]!;
}

describe("rule-aware basic strategy", () => {
  it("changes soft 19 against six with the dealer soft-17 rule", () => {
    const h17 = recommendBasicStrategy({
      playerCards: hand("A", "8"),
      dealerUpCard: up("6"),
      rules: BASE_RULES
    });
    const s17 = recommendBasicStrategy({
      playerCards: hand("A", "8"),
      dealerUpCard: up("6"),
      rules: { ...BASE_RULES, dealerSoft17: "S17" }
    });

    expect(h17).toMatchObject({
      action: "double",
      preferredAction: "double",
      handType: "soft"
    });
    expect(s17.action).toBe("stand");
    expect(h17.explanation).toContain("H17");
  });

  it("uses the double-deck exception for hard 9 against 2", () => {
    const input = {
      playerCards: hand("4", "5"),
      dealerUpCard: up("2"),
      rules: BASE_RULES
    };

    expect(recommendBasicStrategy(input).action).toBe("hit");
    expect(
      recommendBasicStrategy({
        ...input,
        rules: { ...BASE_RULES, decks: 2 }
      }).action
    ).toBe("double");
  });

  it.each([
    [["4", "4"], "5", {}, "split"],
    [["4", "4"], "5", { doubleAfterSplit: false }, "double"],
    [["5", "3"], "5", {}, "double"],
    [["A", "2"], "4", {}, "double"],
    [["A", "7"], "2", {}, "stand"],
    [["A", "7"], "3", {}, "double"],
    [["3", "3"], "8", {}, "split"],
    [["3", "3"], "8", { doubleAfterSplit: false }, "hit"],
    [["6", "6"], "2", { doubleAfterSplit: false }, "split"],
    [["9", "9"], "A", {}, "split"],
    [["9", "9"], "A", { doubleAfterSplit: false }, "stand"],
    [["7", "7"], "10", {}, "surrender"]
  ] as const)(
    "uses the single-deck H17 chart for %j against %s",
    (player, dealerRank, overrides, expected) => {
      expect(
        recommendBasicStrategy({
          playerCards: hand(...player),
          dealerUpCard: up(dealerRank),
          rules: { ...BASE_RULES, decks: 1, ...overrides }
        }).action
      ).toBe(expected);
    }
  );

  it.each([
    [["5", "3"], "5", "double"],
    [["6", "5"], "A", "double"],
    [["A", "7"], "A", "stand"],
    [["10", "6"], "9", "hit"]
  ] as const)(
    "uses the single-deck S17 chart for %j against %s",
    (player, dealerRank, expected) => {
      expect(
        recommendBasicStrategy({
          playerCards: hand(...player),
          dealerUpCard: up(dealerRank),
          rules: {
            ...BASE_RULES,
            decks: 1,
            dealerSoft17: "S17",
            surrender: "late"
          }
        }).action
      ).toBe(expected);
    }
  );

  it("makes pair strategy sensitive to double after split", () => {
    const input = {
      playerCards: hand("4", "4"),
      dealerUpCard: up("5"),
      rules: BASE_RULES
    };

    expect(recommendBasicStrategy(input).action).toBe("split");
    expect(
      recommendBasicStrategy({
        ...input,
        rules: { ...BASE_RULES, doubleAfterSplit: false }
      }).action
    ).toBe("hit");
  });

  it("keeps single-deck eights as a split before late surrender", () => {
    for (const dealer of ["10", "A"] as const) {
      expect(
        recommendBasicStrategy({
          playerCards: hand("8", "8"),
          dealerUpCard: up(dealer),
          rules: {
            ...BASE_RULES,
            decks: 1,
            dealerSoft17: "H17",
            surrender: "late",
            doubleAfterSplit: true
          }
        }).action
      ).toBe("split");
    }
  });

  it("splits single-deck nines against an ace only when the dealer hits soft 17", () => {
    const rules = {
      ...BASE_RULES,
      decks: 1 as const,
      surrender: "late" as const,
      doubleAfterSplit: true
    };
    expect(
      recommendBasicStrategy({
        playerCards: hand("9", "9"),
        dealerUpCard: up("A"),
        rules: { ...rules, dealerSoft17: "H17" }
      }).action
    ).toBe("split");
    expect(
      recommendBasicStrategy({
        playerCards: hand("9", "9"),
        dealerUpCard: up("A"),
        rules: { ...rules, dealerSoft17: "S17" }
      }).action
    ).toBe("stand");
  });

  it.each([
    [2, ["10", "6"], "9", "hit"],
    [2, ["10", "6"], "10", "surrender"],
    [2, ["8", "8"], "A", "split"],
    [6, ["8", "8"], "10", "split"],
    [6, ["8", "8"], "A", "surrender"],
    [6, ["8", "8"], "A", "split", "S17"],
    [6, ["10", "6"], "9", "surrender"],
    [8, ["8", "8"], "10", "split"],
    [8, ["8", "8"], "A", "split", "S17"],
    [8, ["8", "8"], "A", "surrender"]
  ] as const)(
    "uses the composition-aware late-surrender matrix for %i decks, %j against %s",
    (decks, player, dealerRank, expected, soft17 = "H17") => {
      expect(
        recommendBasicStrategy({
          playerCards: hand(...player),
          dealerUpCard: up(dealerRank),
          rules: { ...BASE_RULES, decks, dealerSoft17: soft17 }
        }).action
      ).toBe(expected);
    }
  );

  it("falls back cleanly when the table does not allow the preferred double", () => {
    const decision = recommendBasicStrategy({
      playerCards: hand("5", "4"),
      dealerUpCard: up("6"),
      rules: { ...BASE_RULES, doubleRule: "10_11" }
    });

    expect(decision).toMatchObject({
      preferredAction: "double",
      action: "hit",
      fallbackAction: "hit"
    });
    expect(decision.availableActions).not.toContain("double");
    expect(decision.explanation).toContain("not available");
  });

  it("offers and recommends H17 late surrender without making it universal", () => {
    const input = {
      playerCards: hand("10", "5"),
      dealerUpCard: up("A"),
      rules: BASE_RULES
    };

    expect(recommendBasicStrategy(input).action).toBe("surrender");
    expect(
      recommendBasicStrategy({
        ...input,
        rules: { ...BASE_RULES, surrender: "none" }
      })
    ).toMatchObject({ preferredAction: "hit", action: "hit" });
  });

  it("reports legal actions from the actual hand context", () => {
    expect(
      getAvailableActions({
        playerCards: hand("8", "8"),
        dealerUpCard: up("A"),
        rules: BASE_RULES
      })
    ).toEqual(["hit", "stand", "double", "split", "surrender", "insurance"]);

    expect(
      getAvailableActions({
        playerCards: hand("8", "8", "2"),
        dealerUpCard: up("9"),
        rules: BASE_RULES
      })
    ).toEqual(["hit", "stand"]);
  });

  it.each([
    [["A", "A"], "10", {}, "split"],
    [["10", "Q"], "6", {}, "stand"],
    [["9", "9"], "7", {}, "stand"],
    [["9", "9"], "8", {}, "split"],
    [["7", "7"], "8", {}, "hit"],
    [["7", "7"], "8", { decks: 2 }, "split"],
    [["6", "6"], "2", {}, "split"],
    [["6", "6"], "2", { doubleAfterSplit: false }, "hit"],
    [["5", "5"], "9", {}, "double"],
    [["3", "3"], "2", {}, "split"],
    [["A", "9"], "6", {}, "stand"],
    [["A", "7"], "7", {}, "stand"],
    [["A", "7"], "9", {}, "hit"],
    [["A", "6"], "2", {}, "hit"],
    [["A", "5"], "4", {}, "double"],
    [["A", "3"], "5", {}, "double"],
    [["10", "7"], "A", {}, "surrender"],
    [["10", "3"], "3", {}, "stand"],
    [["10", "3"], "7", {}, "hit"],
    [["10", "2"], "5", {}, "stand"],
    [["10", "2"], "3", {}, "hit"],
    [["6", "5"], "A", { dealerSoft17: "S17" }, "hit"],
    [["6", "4"], "A", {}, "hit"],
    [["4", "4"], "4", {}, "hit"]
  ] as const)(
    "resolves the matrix for %j against %s",
    (player, dealerRank, overrides, expected) => {
      expect(
        recommendBasicStrategy({
          playerCards: hand(...player),
          dealerUpCard: up(dealerRank),
          rules: { ...BASE_RULES, ...overrides }
        }).action
      ).toBe(expected);
    }
  );

  it("enforces contextual split and double restrictions", () => {
    expect(
      getAvailableActions({
        playerCards: hand("A", "A"),
        dealerUpCard: up("6"),
        rules: BASE_RULES,
        afterSplit: true,
        splitAces: true,
        splitHands: 4
      })
    ).toEqual(["hit", "stand"]);
    expect(() =>
      getAvailableActions({
        playerCards: [],
        dealerUpCard: up("6"),
        rules: BASE_RULES
      })
    ).toThrow("at least one");
  });

  it("supports the early-surrender branch explicitly", () => {
    expect(
      recommendBasicStrategy({
        playerCards: hand("10", "4"),
        dealerUpCard: up("10"),
        rules: { ...BASE_RULES, surrender: "early" }
      }).action
    ).toBe("surrender");
    expect(
      recommendBasicStrategy({
        playerCards: hand("3", "3"),
        dealerUpCard: up("A"),
        rules: { ...BASE_RULES, surrender: "early" }
      }).action
    ).toBe("surrender");
  });
});
