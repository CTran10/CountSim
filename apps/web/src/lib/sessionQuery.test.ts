import { describe, expect, it } from "vitest";

import { parseSessionQuery } from "./sessionQuery";

describe("parseSessionQuery", () => {
  it("loads a catalog preset while bounding user limits", () => {
    const parsed = parseSessionQuery({
      preset: "lodge-6d",
      bankroll: "100",
      stopLoss: "500",
      maxBet: "10",
      hands: "25",
      mode: "decision"
    });

    expect(parsed.mode).toBe("decision");
    expect(parsed.config.limits.maxLossCents).toBe(10_000);
    expect(parsed.config.limits.maxHands).toBe(25);
    expect(parsed.config.rules.decks).toBe(6);
    expect(parsed.config.deviationProfileId).toBe("hilo-6d-h17-das-rsa");
  });

  it("validates and loads a complete local custom game", () => {
    const parsed = parseSessionQuery({
      preset: "custom-deep-dd",
      customName: "Deep DD",
      rulesDecks: "2",
      rulesPayout: "3:2",
      rulesSoft17: "S17",
      rulesDouble: "any_two",
      rulesDas: "true",
      rulesSurrender: "late",
      rulesMaxSplit: "4",
      rulesRsa: "true",
      rulesHsa: "false",
      rulesDsa: "false",
      rulesPeek: "true",
      rulesBurn: "false",
      penetrationMode: "range",
      penetrationMin: "0.68",
      penetrationMax: "0.76",
      shuffle: "continuous",
      deviationProfile: "basic-strategy-only",
      intent: "deviations"
    });

    expect(parsed.presetLabel).toBe("Deep DD");
    expect(parsed.config.rules).toMatchObject({
      decks: 2,
      dealerSoft17: "S17",
      surrender: "late"
    });
    expect(parsed.config.penetration.mode).toBe("range");
    expect(parsed.config.shuffleMode).toBe("continuous");
    expect(parsed.config.deviationProfileId).toBe("basic-strategy-only");
    expect(parsed.config.practiceIntent).toBe("basic_strategy");
  });

  it.each([
    ["an omitted profile", undefined],
    ["an incompatible known profile", "hi-lo-shoe-h17"]
  ])(
    "normalizes deviation intent for single-deck custom rules with %s",
    (_label, deviationProfile) => {
      const parsed = parseSessionQuery({
        preset: "custom-single-deck",
        customName: "Single Deck",
        rulesDecks: "1",
        rulesPayout: "3:2",
        rulesSoft17: "H17",
        rulesDouble: "any_two",
        rulesDas: "false",
        rulesSurrender: "none",
        rulesMaxSplit: "4",
        rulesRsa: "false",
        rulesHsa: "false",
        rulesDsa: "false",
        rulesPeek: "true",
        rulesBurn: "false",
        penetrationMode: "fixed",
        penetration: "0.6",
        shuffle: "perfect_random",
        ...(deviationProfile === undefined ? {} : { deviationProfile }),
        intent: "deviations"
      });

      expect(parsed.config.deviationProfileId).toBe("basic-strategy-only");
      expect(parsed.config.practiceIntent).toBe("basic_strategy");
    }
  );

  it("preserves the Lodge no-DAS deviation profile", () => {
    const parsed = parseSessionQuery({ preset: "lodge-dd" });
    expect(parsed.config.rules.doubleAfterSplit).toBe(false);
    expect(parsed.config.deviationProfileId).toBe("hilo-dd-h17-no-das");
    expect(parsed.tableMinimumCents).toBe(2500);
  });

  it("falls back safely when a custom payload is malformed", () => {
    const parsed = parseSessionQuery({
      preset: "custom-bad",
      rulesDecks: "500",
      penetrationMode: "fixed",
      penetration: "9"
    });
    expect(parsed.config.rules.decks).toBe(6);
    expect(parsed.presetLabel).toContain("safe defaults");
  });
});
