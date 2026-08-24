import { describe, expect, it } from "vitest";

import {
  buildSkillProfile,
  generateCountingDrill,
  generateDecisionScenario,
  scheduleTrainingItems,
  scoreSkill,
  type TrainingItem
} from "../src/training";
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

describe("adaptive deterministic training", () => {
  it("scores accuracy, streak, and evidence without wall-clock state", () => {
    const score = scoreSkill("running_count", [
      { correct: true },
      { correct: false },
      { correct: true },
      { correct: true }
    ]);

    expect(score).toEqual({
      skill: "running_count",
      attempts: 4,
      correct: 3,
      streak: 2,
      score: 65
    });
    expect(scoreSkill("true_count", []).score).toBe(0);
  });

  it("builds one stable score per skill", () => {
    const profile = buildSkillProfile([
      { skill: "true_count", correct: false },
      { skill: "basic_strategy", correct: true },
      { skill: "true_count", correct: true }
    ]);

    expect(profile.map((entry) => entry.skill)).toEqual([
      "true_count",
      "basic_strategy"
    ]);
    expect(profile[0]).toMatchObject({ attempts: 2, correct: 1, streak: 1 });
  });

  it("biases the schedule toward weak skills and stays seed-reproducible", () => {
    const items: readonly TrainingItem[] = [
      { id: "rc-1", skills: ["running_count"], difficulty: 1 },
      { id: "tc-1", skills: ["true_count"], difficulty: 2 },
      { id: "bs-1", skills: ["basic_strategy"], difficulty: 2 }
    ];
    const profile = [
      {
        skill: "running_count" as const,
        attempts: 10,
        correct: 10,
        streak: 10,
        score: 100
      },
      {
        skill: "true_count" as const,
        attempts: 10,
        correct: 3,
        streak: 0,
        score: 25
      },
      {
        skill: "basic_strategy" as const,
        attempts: 10,
        correct: 7,
        streak: 2,
        score: 65
      }
    ];

    const first = scheduleTrainingItems({ items, profile, seed: 17, count: 3 });
    const second = scheduleTrainingItems({
      items,
      profile,
      seed: 17,
      count: 3
    });

    expect(first).toEqual(second);
    expect(first.map((item) => item.id)).toEqual(["tc-1", "bs-1", "rc-1"]);
    expect(items.map((item) => item.id)).toEqual(["rc-1", "tc-1", "bs-1"]);

    const extended = scheduleTrainingItems({
      items,
      profile,
      seed: 17,
      count: 60
    });
    const trueCountFrequency = extended.filter(
      (item) => item.id === "tc-1"
    ).length;
    const runningCountFrequency = extended.filter(
      (item) => item.id === "rc-1"
    ).length;
    expect(trueCountFrequency).toBeGreaterThan(runningCountFrequency);
  });

  it("generates a repeatable running-count drill with its answer key", () => {
    const drill = generateCountingDrill({
      seed: 91,
      length: 24,
      startingCount: -2
    });

    expect(drill).toEqual(
      generateCountingDrill({ seed: 91, length: 24, startingCount: -2 })
    );
    expect(drill.cards).toHaveLength(24);
    expect(drill.expectedHistory).toHaveLength(24);
    expect(drill.finalRunningCount).toBe(drill.expectedHistory.at(-1));
    expect(() => generateCountingDrill({ seed: 1, length: 0 })).toThrow(
      "positive"
    );
  });

  it("generates deterministic basic and deviation decision scenarios", () => {
    const basic = generateDecisionScenario({
      seed: 33,
      rules: RULES,
      profile: "hi-lo-shoe-h17",
      focus: "basic_strategy"
    });
    const deviation = generateDecisionScenario({
      seed: 33,
      rules: RULES,
      profile: "hi-lo-shoe-h17",
      focus: "deviations"
    });

    expect(basic).toEqual(
      generateDecisionScenario({
        seed: 33,
        rules: RULES,
        profile: "hi-lo-shoe-h17",
        focus: "basic_strategy"
      })
    );
    expect(basic.basicDecision.availableActions).toContain(
      basic.basicDecision.action
    );
    expect(deviation.deviationDecision.opportunity).toBe(true);
    expect(deviation.prompt).toContain("True count");
  });

  it("validates scheduler and drill input boundaries", () => {
    expect(
      scheduleTrainingItems({ items: [], profile: [], seed: 0, count: 0 })
    ).toEqual([]);
    expect(() =>
      scheduleTrainingItems({ items: [], profile: [], seed: 0, count: 1 })
    ).toThrow("without items");
    expect(() =>
      scheduleTrainingItems({ items: [], profile: [], seed: -1, count: 0 })
    ).toThrow("seed");
    expect(() =>
      scheduleTrainingItems({ items: [], profile: [], seed: 0, count: -1 })
    ).toThrow("count");
    expect(() =>
      scheduleTrainingItems({
        items: [
          { id: "same", skills: ["true_count"], difficulty: 1 },
          { id: "same", skills: ["running_count"], difficulty: 1 }
        ],
        profile: [],
        seed: 0,
        count: 1
      })
    ).toThrow("unique");
    expect(() =>
      scheduleTrainingItems({
        items: [{ id: "empty", skills: [], difficulty: 1 }],
        profile: [],
        seed: 0,
        count: 1
      })
    ).toThrow("at least one skill");
    expect(() =>
      scheduleTrainingItems({
        items: [
          {
            id: "bad-difficulty",
            skills: ["true_count"],
            difficulty: Number.NaN as 1
          }
        ],
        profile: [],
        seed: 0,
        count: 1
      })
    ).toThrow("difficulty");
    expect(() =>
      scheduleTrainingItems({
        items: [{ id: "valid", skills: ["true_count"], difficulty: 1 }],
        profile: [
          {
            skill: "true_count",
            attempts: 1,
            correct: 1,
            streak: 1,
            score: Number.NaN
          }
        ],
        seed: 0,
        count: 1
      })
    ).toThrow("profile");
    expect(() => generateCountingDrill({ seed: -1, length: 1 })).toThrow(
      "seed"
    );
    expect(() => generateCountingDrill({ seed: 1, length: 417 })).toThrow(
      "eight decks"
    );
  });

  it("supports mixed scenario selection and rejects an unsafe seed", () => {
    expect(["basic_strategy", "deviations"] as const).toContain(
      generateDecisionScenario({
        seed: 1,
        rules: RULES,
        profile: "hi-lo-shoe-h17"
      }).focus
    );
    expect(() =>
      generateDecisionScenario({
        seed: -1,
        rules: RULES,
        profile: "hi-lo-shoe-h17"
      })
    ).toThrow("seed");
  });
});
