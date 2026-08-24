import { describe, expect, it } from "vitest";

import { DEFAULT_SEED, readSeed } from "./seed";

describe("readSeed", () => {
  it.each([
    undefined,
    "",
    "   ",
    "not-a-number",
    "1.5",
    "-1",
    "4294967296",
    "1e100"
  ])("falls back for an absent or unsafe value", (value) => {
    expect(readSeed(value)).toBe(DEFAULT_SEED);
  });

  it("accepts an unsigned 32-bit integer and the first repeated query value", () => {
    expect(readSeed("42")).toBe(42);
    expect(readSeed("0")).toBe(0);
    expect(readSeed("4294967295")).toBe(4294967295);
    expect(readSeed(["7", "8"])).toBe(7);
  });
});
