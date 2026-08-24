import { describe, expect, it } from "vitest";

import {
  dealerShouldHit,
  evaluateHand,
  resolveOutcome,
  type Card,
  type Rank
} from "../src/index";

function hand(...ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => ({
    id: `fixture-${index}-${rank}`,
    rank,
    suit: "spades"
  }));
}

describe("blackjack rules", () => {
  it("values multiple aces without busting", () => {
    expect(evaluateHand(hand("A", "A", "9"))).toMatchObject({
      total: 21,
      soft: true,
      blackjack: false,
      bust: false
    });
    expect(evaluateHand(hand("A", "A", "9", "K"))).toMatchObject({
      total: 21,
      soft: false,
      blackjack: false,
      bust: false
    });
  });

  it("distinguishes a natural from a three-card 21", () => {
    expect(evaluateHand(hand("A", "K")).blackjack).toBe(true);
    expect(evaluateHand(hand("7", "7", "7")).blackjack).toBe(false);
  });

  it("hits soft 17 under H17 while standing on hard 17", () => {
    expect(dealerShouldHit(hand("A", "6"), true)).toBe(true);
    expect(dealerShouldHit(hand("10", "7"), true)).toBe(false);
    expect(dealerShouldHit(hand("A", "6"), false)).toBe(false);
  });

  it("lets a split 21 be valued as 21 without treating it as a natural", () => {
    expect(
      evaluateHand(hand("A", "K"), { naturalEligible: false })
    ).toMatchObject({ total: 21, blackjack: false, bust: false });
  });

  it.each([
    [hand("10", "8"), hand("10", "7"), "win"],
    [hand("10", "7"), hand("10", "8"), "loss"],
    [hand("10", "8"), hand("9", "9"), "push"],
    [hand("K", "Q", "2"), hand("10", "7"), "loss"],
    [hand("A", "K"), hand("10", "Q"), "blackjack"],
    [hand("10", "8"), hand("K", "Q", "2"), "win"],
    [hand("10", "8"), hand("A", "K"), "loss"],
    [hand("A", "K"), hand("A", "K"), "push"]
  ] as const)(
    "resolves player and dealer hands",
    (player, dealer, expected) => {
      expect(resolveOutcome(player, dealer)).toBe(expected);
    }
  );
});
