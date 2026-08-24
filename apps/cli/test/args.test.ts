import { describe, expect, it } from "vitest";

import { parseArgs } from "../src/args.ts";
import { formatSimulation } from "../src/format.ts";
import { runDeterministicSimulation } from "@trueedge/game-core";

describe("simulation CLI arguments", () => {
  it("loads a preset and accepts percent penetration", () => {
    const options = parseArgs([
      "--",
      "--preset",
      "lodge-dd",
      "--hands",
      "250",
      "--seed",
      "42",
      "--penetration",
      "68",
      "--json"
    ]);
    expect(options).toMatchObject({
      presetId: "lodge-dd",
      rounds: 250,
      seed: 42,
      penetration: 0.68,
      deviationProfileId: "hilo-dd-h17-no-das",
      json: true
    });
    expect(options.rules.decks).toBe(2);
  });

  it("uses the selected preset's training penetration by default", () => {
    expect(parseArgs(["--preset", "lodge-dd"]).penetration).toBe(0.65);
    expect(parseArgs(["--preset", "lodge-6d"]).penetration).toBe(0.75);
  });

  it.each([
    ["--preset", "missing"],
    ["--hands", "0"],
    ["--seed", "-1"],
    ["--penetration", "100"]
  ])("rejects invalid %s input", (flag, value) => {
    expect(() => parseArgs([flag, value])).toThrow();
  });

  it("formats the deterministic result as a compact text report", () => {
    const options = parseArgs(["--hands", "5", "--seed", "42"]);
    const result = runDeterministicSimulation({
      seed: options.seed,
      rounds: options.rounds,
      rules: options.rules,
      profile: options.deviationProfileId,
      penetration: options.penetration
    });
    const report = formatSimulation(
      result,
      options.presetId,
      options.penetration
    );
    expect(report).toContain("TrueEdge deterministic simulation");
    expect(report).toContain("Rounds        5");
    expect(report).toContain("Index capture");
  });
});
