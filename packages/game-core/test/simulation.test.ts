import { describe, expect, it } from "vitest";

import {
  runDeterministicSimulation,
  summarizeSimulation,
  type SimulationRoundRecord
} from "../src/simulation";
import type { GameRules } from "../src/types";

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

describe("deterministic simulation metrics", () => {
  it("summarizes outcomes and decision opportunities exactly", () => {
    const records: readonly SimulationRoundRecord[] = [
      {
        roundNumber: 1,
        outcomes: ["blackjack"],
        initialTrueCount: 2,
        decisionTrueCounts: [2],
        deviationOpportunities: 1,
        deviationsTriggered: 1
      },
      {
        roundNumber: 2,
        outcomes: ["win", "loss"],
        initialTrueCount: -1,
        decisionTrueCounts: [-1, 1],
        deviationOpportunities: 1,
        deviationsTriggered: 0
      },
      {
        roundNumber: 3,
        outcomes: ["push", "surrender"],
        initialTrueCount: 0,
        decisionTrueCounts: [0],
        deviationOpportunities: 0,
        deviationsTriggered: 0
      }
    ];

    expect(summarizeSimulation(records, 1)).toEqual({
      rounds: 3,
      hands: 5,
      wins: 1,
      losses: 1,
      pushes: 1,
      blackjacks: 1,
      surrenders: 1,
      winRate: 0.4,
      lossRate: 0.4,
      trueCountThresholdOpportunities: 2,
      deviationOpportunities: 2,
      deviationsTriggered: 1,
      deviationCaptureRate: 0.5
    });
  });

  it("replays the same seeded shoes and decisions exactly", () => {
    const input = {
      seed: 742,
      rounds: 120,
      rules: RULES,
      profile: "hi-lo-shoe-h17" as const,
      penetration: 0.75,
      trueCountThreshold: 2
    };
    const first = runDeterministicSimulation(input);
    const second = runDeterministicSimulation(input);

    expect(first).toEqual(second);
    expect(first.records).toHaveLength(120);
    expect(first.metrics.rounds).toBe(120);
    expect(first.metrics.hands).toBeGreaterThanOrEqual(120);
    expect(first.metrics.deviationOpportunities).toBeGreaterThan(0);
    expect(first.metrics.deviationsTriggered).toBeLessThanOrEqual(
      first.metrics.deviationOpportunities
    );
  });

  it("changes the replay when the seed changes", () => {
    const first = runDeterministicSimulation({
      seed: 1,
      rounds: 40,
      rules: RULES
    });
    const second = runDeterministicSimulation({
      seed: 2,
      rounds: 40,
      rules: RULES
    });

    expect(first.records).not.toEqual(second.records);
  });

  it("rejects unsafe simulation boundaries", () => {
    expect(() =>
      runDeterministicSimulation({ seed: -1, rounds: 1, rules: RULES })
    ).toThrow("seed");
    expect(() =>
      runDeterministicSimulation({ seed: 1, rounds: 0, rules: RULES })
    ).toThrow("rounds");
    expect(() =>
      runDeterministicSimulation({
        seed: 1,
        rounds: 1,
        rules: RULES,
        penetration: 1
      })
    ).toThrow("Penetration");
    expect(() =>
      runDeterministicSimulation({ seed: 1, rounds: 100_001, rules: RULES })
    ).toThrow("rounds");
    expect(() =>
      runDeterministicSimulation({
        seed: 1,
        rounds: 1,
        rules: RULES,
        trueCountThreshold: Number.NaN
      })
    ).toThrow("threshold");
    expect(() => summarizeSimulation([], Number.NaN)).toThrow("threshold");
  });

  it("returns zero-safe rates for an empty summary", () => {
    expect(summarizeSimulation([])).toMatchObject({
      rounds: 0,
      hands: 0,
      winRate: 0,
      lossRate: 0,
      deviationCaptureRate: 0
    });
  });

  it("supports burn-card and default S17 profile selection", () => {
    const result = runDeterministicSimulation({
      seed: 9,
      rounds: 10,
      rules: {
        ...RULES,
        dealerSoft17: "S17",
        burnCard: true,
        surrender: "none"
      }
    });

    expect(result.profileId).toBe("hi-lo-shoe-s17");
    expect(result.records).toHaveLength(10);
  });
});
