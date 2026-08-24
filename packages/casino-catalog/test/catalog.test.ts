import { describe, expect, it } from "vitest";

import {
  BLACK_HAWK_PRESETS,
  assertValidCustomPreset,
  comparePresets,
  getPreset,
  listPresets,
  searchPresets,
  validateCustomPreset
} from "../src";

describe("Black Hawk catalog", () => {
  it("contains the ten requested venue and deck presets", () => {
    expect(BLACK_HAWK_PRESETS).toHaveLength(10);
    expect(BLACK_HAWK_PRESETS.map((preset) => preset.id)).toEqual([
      "ballys-north-dd",
      "ballys-north-6d",
      "ballys-west-dd",
      "ballys-west-6d",
      "lodge-dd",
      "lodge-6d",
      "ameristar-dd",
      "ameristar-6d",
      "monarch-dd",
      "monarch-6d"
    ]);
  });

  it("keeps every penetration value explicitly adjustable and separate from live claims", () => {
    for (const preset of BLACK_HAWK_PRESETS) {
      expect(preset.penetrationBasis).toMatchObject({
        kind: "training_default",
        adjustable: true,
        confidence: "low"
      });
      expect(preset.penetrationBasis.notes).toContain(
        "not a claim about a live table"
      );
      expect(preset.provenance.currentStatusCaveat).toContain(
        "Confirm the table placard"
      );
    }
  });

  it("records historical minima without inventing maximums", () => {
    expect(getPreset("ameristar-dd")?.historicalLimits.minimumCents).toBe(
      10_000
    );
    expect(getPreset("ballys-west-6d")?.historicalLimits.minimumCents).toBe(
      1_000
    );
    expect(getPreset("monarch-6d")?.historicalLimits.minimumCents).toBe(1_500);
    expect(
      BLACK_HAWK_PRESETS.every(
        (preset) => preset.historicalLimits.maximumCents === null
      )
    ).toBe(true);
  });

  it("keeps Ameristar's current official posting separate from historical limits", () => {
    const ameristar = getPreset("ameristar-dd");
    expect(ameristar?.historicalLimits.minimumCents).toBe(10_000);
    expect(ameristar?.provenance.currentPostedLimits).toMatchObject({
      minimumCents: 1_000,
      maximumCents: null,
      accessedAt: "2026-08-23",
      confidence: "high"
    });
    expect(ameristar?.provenance.currentPostedLimits?.caveat).toContain(
      "does not say this schedule applies to the double-deck table"
    );
    expect(getPreset("lodge-dd")?.provenance.currentPostedLimits).toBeNull();
  });

  it("models the source-specific rule differences from the historical survey", () => {
    expect(getPreset("lodge-dd")?.rules.doubleAfterSplit).toBe(false);
    expect(getPreset("ameristar-dd")?.rules.resplitAces).toBe(true);
    expect(getPreset("ballys-north-dd")?.rules.resplitAces).toBe(false);
    expect(
      BLACK_HAWK_PRESETS.every(
        (preset) => preset.rules.blackjackPayout === "3:2"
      )
    ).toBe(true);
    expect(
      BLACK_HAWK_PRESETS.every((preset) => preset.rules.dealerSoft17 === "H17")
    ).toBe(true);
  });

  it("attaches regulation, historical survey, and official venue provenance", () => {
    for (const preset of BLACK_HAWK_PRESETS) {
      expect(preset.sources.map((source) => source.type)).toEqual([
        "official",
        "published",
        "regulation"
      ]);
      expect(preset.provenance.rulesObservedAt).toBe("2024-08-01");
      expect(preset.provenance.currentAvailabilityAccessedAt).toBe(
        "2026-08-23"
      );
      expect(
        preset.sources.every((source) => source.url.startsWith("https://"))
      ).toBe(true);
    }
  });

  it("passes every bundled preset through the custom-preset boundary", () => {
    for (const preset of BLACK_HAWK_PRESETS) {
      expect(validateCustomPreset(preset)).toEqual({
        success: true,
        data: preset
      });
    }
  });
});

describe("catalog queries", () => {
  it("lists by casino and deck count", () => {
    expect(
      listPresets({ casino: " monarch ", decks: 6 }).map((preset) => preset.id)
    ).toEqual(["monarch-6d"]);
    expect(listPresets({ decks: 2 })).toHaveLength(5);
  });

  it("gets a preset without synthesizing unknown ids", () => {
    expect(getPreset("lodge-dd")?.venue).toBe("The Lodge Casino");
    expect(getPreset("missing")).toBeUndefined();
  });

  it("searches across venue, location, deck shorthand, and rules", () => {
    expect(searchPresets("Bally 6d")).toHaveLength(2);
    expect(searchPresets("Black Hawk dd")).toHaveLength(5);
    expect(searchPresets("S17")).toEqual([]);
    expect(searchPresets("  ")).toHaveLength(10);
  });

  it("compares rules, limits, and training penetration", () => {
    const comparison = comparePresets(["lodge-dd", "lodge-6d"]);
    expect(comparison.presets.map((preset) => preset.id)).toEqual([
      "lodge-dd",
      "lodge-6d"
    ]);
    expect(
      comparison.rows.find((row) => row.field === "doubleAfterSplit")
    ).toMatchObject({
      values: [false, true],
      differs: true
    });
    expect(
      comparison.rows.find((row) => row.field === "blackjackPayout")?.differs
    ).toBe(false);
  });

  it("rejects invalid comparison requests", () => {
    expect(() => comparePresets(["lodge-dd"])).toThrow("at least two");
    expect(() => comparePresets(["lodge-dd", "lodge-dd"])).toThrow("duplicate");
    expect(() => comparePresets(["lodge-dd", "missing"])).toThrow(
      "Unknown preset: missing"
    );
  });
});

describe("custom preset validation", () => {
  it("accepts a structurally complete custom preset", () => {
    const custom = {
      ...getPreset("lodge-dd"),
      id: "my-local-dd",
      casino: "My local game",
      venue: "Custom table"
    };

    const result = validateCustomPreset(custom);
    expect(result.success).toBe(true);
    expect(assertValidCustomPreset(custom).id).toBe("my-local-dd");
  });

  it("reports unsafe or incomplete custom preset fields", () => {
    const invalid = {
      ...getPreset("lodge-dd"),
      id: "Not Valid",
      rules: { ...getPreset("lodge-dd")?.rules, decks: 3, maxSplitHands: 1 },
      penetration: { mode: "fixed", penetration: 1.2 },
      historicalLimits: {
        ...getPreset("lodge-dd")?.historicalLimits,
        minimumCents: 5000,
        maximumCents: 1000
      },
      sources: [
        {
          title: "Bad source",
          url: "javascript:alert(1)",
          type: "user",
          confidence: "low",
          notes: "No date or safe URL"
        }
      ],
      provenance: {
        ...getPreset("lodge-dd")?.provenance,
        rulesObservedAt: "2024-02-31"
      }
    };

    const result = validateCustomPreset(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "id has an invalid format.",
          "rules.decks has an unsupported value.",
          "rules.maxSplitHands must be an integer from 2 through 4.",
          "penetration.penetration must be greater than 0 and at most 1.",
          "historicalLimits.maximumCents cannot be below minimumCents.",
          "provenance.rulesObservedAt must be an ISO date in YYYY-MM-DD format.",
          "sources[0].url must be an HTTP or HTTPS URL.",
          "sources[0] must include observedAt or accessedAt."
        ])
      );
    }
  });
});
