import { describe, expect, it } from "vitest";

import { createShoe } from "../src/index";

describe("createShoe", () => {
  it.each([1, 2, 4, 6, 8] as const)(
    "creates all physical cards for %i decks",
    (decks) => {
      const shoe = createShoe({
        decks,
        penetration: 0.75,
        seed: 1,
        shoeNumber: 0
      });
      expect(shoe.cards).toHaveLength(decks * 52);
      expect(new Set(shoe.cards.map((card) => card.id)).size).toBe(decks * 52);
    }
  );

  it("creates a deterministic six-deck shoe with unique physical cards", () => {
    const first = createShoe({
      decks: 6,
      penetration: 0.75,
      seed: 785390425,
      shoeNumber: 0
    });
    const second = createShoe({
      decks: 6,
      penetration: 0.75,
      seed: 785390425,
      shoeNumber: 0
    });

    expect(first.cards).toHaveLength(312);
    expect(new Set(first.cards.map((card) => card.id)).size).toBe(312);
    expect(first.cutIndex).toBe(234);
    expect(first.cards.map((card) => card.id)).toEqual(
      second.cards.map((card) => card.id)
    );
  });

  it("changes the shoe when the seed changes", () => {
    const first = createShoe({
      decks: 6,
      penetration: 0.75,
      seed: 1,
      shoeNumber: 0
    });
    const second = createShoe({
      decks: 6,
      penetration: 0.75,
      seed: 2,
      shoeNumber: 0
    });

    expect(first.cards.slice(0, 12).map((card) => card.id)).not.toEqual(
      second.cards.slice(0, 12).map((card) => card.id)
    );
  });

  it.each(["perfect", "automatic", "simulated_hand", "continuous"] as const)(
    "records and deterministically applies the %s shuffle mode",
    (shuffleMode) => {
      const first = createShoe({
        decks: 2,
        penetration: 0.7,
        seed: 84,
        shoeNumber: 2,
        shuffleMode
      });
      const second = createShoe({
        decks: 2,
        penetration: 0.7,
        seed: 84,
        shoeNumber: 2,
        shuffleMode
      });

      expect(first.shuffleMode).toBe(shuffleMode);
      expect(first.cards.map((card) => card.id)).toEqual(
        second.cards.map((card) => card.id)
      );
    }
  );

  it("uses a different deterministic order for simulated hand shuffling", () => {
    const base = {
      decks: 2,
      penetration: 0.7,
      seed: 84,
      shoeNumber: 0
    } as const;
    const perfect = createShoe({ ...base, shuffleMode: "perfect" });
    const hand = createShoe({ ...base, shuffleMode: "simulated_hand" });

    expect(hand.cards.map((card) => card.id)).not.toEqual(
      perfect.cards.map((card) => card.id)
    );
  });

  it("pins the versioned shuffle output for the default seed", () => {
    const shoe = createShoe({
      decks: 6,
      penetration: 0.75,
      seed: 785390425,
      shoeNumber: 0
    });

    expect(shoe.cards.slice(0, 6).map((card) => card.id)).toEqual([
      "shoe-0-deck-0-hearts-7",
      "shoe-0-deck-4-hearts-5",
      "shoe-0-deck-5-hearts-K",
      "shoe-0-deck-0-hearts-K",
      "shoe-0-deck-1-clubs-9",
      "shoe-0-deck-2-spades-6"
    ]);
  });

  it.each([
    [{ decks: 0, penetration: 0.75, seed: 1, shoeNumber: 0 }, "Deck count"],
    [{ decks: 3, penetration: 0.75, seed: 1, shoeNumber: 0 }, "Deck count"],
    [{ decks: 6, penetration: 1, seed: 1, shoeNumber: 0 }, "Penetration"],
    [{ decks: 6, penetration: 0.75, seed: Number.NaN, shoeNumber: 0 }, "Seed"],
    [
      { decks: 6, penetration: 0.75, seed: 4_294_967_296, shoeNumber: 0 },
      "Seed"
    ],
    [{ decks: 6, penetration: 0.75, seed: 1, shoeNumber: -1 }, "Shoe number"]
  ])("rejects an invalid shoe configuration", (config, message) => {
    expect(() => createShoe(config)).toThrow(message);
  });
});
