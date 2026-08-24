import { describe, expect, it } from "vitest";

import { cardAsset, cardLabel, formatCents } from "./format";

describe("presentation formatting", () => {
  it("formats neutral and signed virtual balances", () => {
    expect(formatCents(2500)).toBe("$25");
    expect(formatCents(2500, true)).toBe("+$25");
    expect(formatCents(-500, true)).toBe("-$5");
  });

  it("maps card data to the vendored asset and accessible label", () => {
    const card = { id: "fixture", rank: "A", suit: "spades" } as const;
    expect(cardAsset(card)).toBe("/cards/AS.svg");
    expect(cardLabel(card)).toBe("Ace of spades");
  });
});
