import { describe, expect, it } from "vitest";

import {
  calculateTrueCount,
  hiLoValue,
  projectExposedCards,
  type Card
} from "../src/index";

const cards = ["2", "K", "5", "9", "A", "6"].map(
  (rank, index) =>
    ({
      id: `fixture-${index}`,
      rank,
      suit: "clubs"
    }) as Card
);

describe("Hi-Lo", () => {
  it("assigns the standard tag to every rank class", () => {
    expect(cards.map(hiLoValue)).toEqual([1, -1, 1, 0, -1, 1]);
  });

  it("projects the running count after every exposed card", () => {
    expect(projectExposedCards(cards).history).toEqual([1, 0, 1, 1, 0, 1]);
  });

  it("distinguishes truncate, floor, and nearest for negative counts", () => {
    const input = {
      runningCount: -7,
      cardsRemaining: 130,
      estimation: "half" as const
    };

    expect(
      calculateTrueCount({ ...input, resolution: "truncate" })
    ).toMatchObject({
      decksRemainingExact: 2.5,
      decksRemainingEstimated: 2.5,
      trueCountRaw: -2.8,
      trueCountResolved: -2
    });
    expect(
      calculateTrueCount({ ...input, resolution: "floor" }).trueCountResolved
    ).toBe(-3);
    expect(
      calculateTrueCount({ ...input, resolution: "nearest" }).trueCountResolved
    ).toBe(-3);
  });

  it("supports whole-deck and exact estimation", () => {
    expect(
      calculateTrueCount({
        runningCount: 5,
        cardsRemaining: 78,
        estimation: "whole",
        resolution: "nearest"
      })
    ).toMatchObject({
      decksRemainingExact: 1.5,
      decksRemainingEstimated: 2,
      trueCountRaw: 2.5,
      trueCountResolved: 3
    });
    expect(
      calculateTrueCount({
        runningCount: 5,
        cardsRemaining: 78,
        estimation: "exact",
        resolution: "truncate"
      }).decksRemainingEstimated
    ).toBe(1.5);
  });

  it("rejects an invalid remaining-card count", () => {
    expect(() =>
      calculateTrueCount({ runningCount: 1, cardsRemaining: -1 })
    ).toThrow("Cards remaining");
  });
});
