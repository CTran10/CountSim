import { describe, expect, it } from "vitest";

import {
  createDeviationProfile,
  evaluateDeviation,
  evaluateInsuranceDeviation,
  getDeviationProfile,
  listDeviationProfiles,
  resolveDeviationProfileForRules,
  type DeviationProfile
} from "../src/deviations";
import type { Card, GameRules, Rank } from "../src/types";

const RULES: GameRules = {
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

function cards(...ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => ({
    id: `deviation-${index}-${rank}`,
    rank,
    suit: "hearts"
  }));
}

function dealer(rank: Rank): Card {
  return cards(rank)[0]!;
}

describe("Hi-Lo deviation profiles", () => {
  it("ships distinct shoe H17, shoe S17, and double-deck H17 profiles", () => {
    expect(listDeviationProfiles().map((profile) => profile.id)).toEqual(
      expect.arrayContaining([
        "hi-lo-shoe-h17",
        "hi-lo-shoe-s17",
        "hi-lo-dd-h17",
        "hilo-dd-h17-no-das",
        "hilo-6d-h17-das-rsa"
      ])
    );
    expect(getDeviationProfile("hi-lo-shoe-h17").entries).toHaveLength(22);
  });

  it("resolves only profiles compatible with the selected rules", () => {
    expect(resolveDeviationProfileForRules(RULES)).toBe("hi-lo-shoe-h17");
    expect(
      resolveDeviationProfileForRules({ ...RULES, decks: 1 }, undefined)
    ).toBe("basic-strategy-only");
    expect(resolveDeviationProfileForRules(RULES, "hi-lo-dd-h17")).toBe(
      "basic-strategy-only"
    );
    expect(resolveDeviationProfileForRules(RULES, "missing-profile")).toBe(
      "basic-strategy-only"
    );
  });

  it("uses profile-specific 11 against ace indices", () => {
    const input = {
      playerCards: cards("6", "5"),
      dealerUpCard: dealer("A"),
      rules: RULES,
      trueCount: -1
    };

    expect(
      evaluateDeviation({ ...input, profile: "hi-lo-shoe-h17" })
    ).toMatchObject({
      opportunity: true,
      thresholdMet: true,
      action: "double"
    });
    expect(
      evaluateDeviation({
        ...input,
        rules: { ...RULES, decks: 2 },
        profile: "hi-lo-dd-h17"
      })
    ).toMatchObject({ thresholdMet: false, action: "hit" });
    expect(
      evaluateDeviation({
        ...input,
        trueCount: 0,
        rules: { ...RULES, decks: 2 },
        profile: "hi-lo-dd-h17"
      })
    ).toMatchObject({ thresholdMet: true, action: "double" });
  });

  it("grades the Fab 4 only when surrender is available", () => {
    const input = {
      profile: "hi-lo-shoe-h17" as const,
      playerCards: cards("10", "5"),
      dealerUpCard: dealer("A"),
      rules: RULES,
      trueCount: -1
    };

    expect(evaluateDeviation(input)).toMatchObject({
      entry: { id: "fab4-15-a" },
      opportunity: true,
      eligible: true,
      action: "surrender"
    });
    expect(
      evaluateDeviation({
        ...input,
        rules: { ...RULES, surrender: "none" }
      })
    ).toMatchObject({ opportunity: true, eligible: false, action: "hit" });
  });

  it("does not replace an available surrender with a no-surrender stand index", () => {
    const input = {
      profile: "hi-lo-shoe-h17" as const,
      playerCards: cards("10", "6"),
      dealerUpCard: dealer("10"),
      rules: RULES,
      trueCount: 0
    };

    expect(evaluateDeviation(input)).toMatchObject({
      entry: { id: "i18-16-10" },
      eligible: false,
      action: "surrender"
    });
    expect(
      evaluateDeviation({
        ...input,
        rules: { ...RULES, surrender: "none" }
      })
    ).toMatchObject({ eligible: true, thresholdMet: true, action: "stand" });
  });

  it("keeps splittable pairs out of hard-total indices", () => {
    expect(
      evaluateDeviation({
        profile: "hi-lo-shoe-h17",
        playerCards: cards("8", "8"),
        dealerUpCard: dealer("10"),
        rules: { ...RULES, surrender: "none" },
        trueCount: 0
      })
    ).toMatchObject({ opportunity: false, action: "split" });
  });

  it("keeps eights out of hard-total indices when late surrender is offered", () => {
    const decision = evaluateDeviation({
      playerCards: cards("8", "8"),
      dealerUpCard: dealer("10"),
      rules: { ...RULES, surrender: "late" },
      canSplit: true,
      profile: "hi-lo-shoe-h17",
      trueCount: 8
    });

    expect(decision.basicAction).toBe("split");
    expect(decision.opportunity).toBe(false);
    expect(decision.action).toBe("split");
  });

  it("does not replace early surrender below a Fab 4 threshold", () => {
    expect(
      evaluateDeviation({
        profile: "hi-lo-shoe-h17",
        playerCards: cards("10", "5"),
        dealerUpCard: dealer("10"),
        rules: { ...RULES, surrender: "early" },
        trueCount: -1
      })
    ).toMatchObject({
      entry: { id: "fab4-15-10" },
      thresholdMet: false,
      action: "surrender"
    });
  });

  it("takes insurance at the profile threshold", () => {
    expect(
      evaluateInsuranceDeviation({
        profile: "hi-lo-shoe-h17",
        rules: RULES,
        trueCount: 2
      })
    ).toMatchObject({
      opportunity: true,
      thresholdMet: false,
      action: "decline"
    });
    expect(
      evaluateInsuranceDeviation({
        profile: "hi-lo-shoe-h17",
        rules: RULES,
        trueCount: 3
      })
    ).toMatchObject({ thresholdMet: true, action: "insurance" });
  });

  it("accepts validated custom S17 profiles", () => {
    const custom: DeviationProfile = createDeviationProfile({
      id: "local-s17",
      label: "Local S17",
      countSystem: "Hi-Lo",
      deckClass: "shoe",
      dealerSoft17: "S17",
      entries: [
        {
          id: "custom-12-2",
          label: "12 vs 2",
          category: "custom",
          rank: 1,
          match: { kind: "hard", total: 12, dealer: "2" },
          index: 4,
          action: "stand",
          belowIndexAction: "hit",
          explanation: "Local composition-derived index."
        }
      ]
    });

    expect(
      evaluateDeviation({
        profile: custom,
        playerCards: cards("10", "2"),
        dealerUpCard: dealer("2"),
        rules: { ...RULES, dealerSoft17: "S17" },
        trueCount: 4
      }).action
    ).toBe("stand");
    expect(() => createDeviationProfile({ ...custom, entries: [] })).toThrow(
      "at least one"
    );
  });

  it("validates profile boundaries and incompatible rules", () => {
    const builtIn = getDeviationProfile("hi-lo-shoe-h17");
    expect(() => getDeviationProfile("missing")).toThrow("Unknown");
    expect(() =>
      createDeviationProfile({ ...builtIn, id: "", label: "" })
    ).toThrow("id and label");
    expect(() =>
      createDeviationProfile({
        ...builtIn,
        id: "duplicate",
        entries: [builtIn.entries[0]!, builtIn.entries[0]!]
      })
    ).toThrow("unique");
    expect(() =>
      createDeviationProfile({
        ...builtIn,
        id: "fractional-index",
        entries: [{ ...builtIn.entries[0]!, index: 2.5 }]
      })
    ).toThrow("integers");

    expect(
      evaluateDeviation({
        profile: "hi-lo-shoe-h17",
        playerCards: cards("10", "6"),
        dealerUpCard: dealer("10"),
        rules: { ...RULES, dealerSoft17: "S17" },
        trueCount: 0
      })
    ).toMatchObject({ profileCompatible: false, eligible: false });
    expect(
      evaluateDeviation({
        profile: "hi-lo-shoe-h17",
        playerCards: cards("A", "7"),
        dealerUpCard: dealer("8"),
        rules: RULES,
        trueCount: 0
      })
    ).toMatchObject({ opportunity: false, action: "stand" });
  });

  it("rejects non-finite counts and profiles without insurance", () => {
    expect(() =>
      evaluateDeviation({
        profile: "hi-lo-shoe-h17",
        playerCards: cards("10", "6"),
        dealerUpCard: dealer("10"),
        rules: RULES,
        trueCount: Number.NaN
      })
    ).toThrow("finite");
    expect(() =>
      evaluateInsuranceDeviation({
        profile: "hi-lo-shoe-h17",
        rules: RULES,
        trueCount: Number.POSITIVE_INFINITY
      })
    ).toThrow("finite");

    const noInsurance = createDeviationProfile({
      id: "no-insurance",
      label: "No insurance",
      countSystem: "Custom",
      deckClass: "custom",
      dealerSoft17: "H17",
      entries: [
        {
          id: "hard-12-2",
          label: "12 vs 2",
          category: "custom",
          rank: 1,
          match: { kind: "hard", total: 12, dealer: "2" },
          index: 3,
          action: "stand",
          belowIndexAction: "hit",
          explanation: "Custom."
        }
      ]
    });
    expect(() =>
      evaluateInsuranceDeviation({
        profile: noInsurance,
        rules: RULES,
        trueCount: 3
      })
    ).toThrow("insurance index");
  });
});
