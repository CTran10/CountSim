import { describe, expect, it } from "vitest";

import { resolvePenetration } from "../src/index";

describe("penetration models", () => {
  it("returns a fixed cut exactly", () => {
    expect(
      resolvePenetration({ mode: "fixed", penetration: 0.75 }, 42, 0)
    ).toBe(0.75);
  });

  it("samples a range deterministically by seed and shoe number", () => {
    const config = {
      mode: "range" as const,
      minPenetration: 0.68,
      maxPenetration: 0.78
    };
    const first = resolvePenetration(config, 42, 3);
    expect(first).toBe(resolvePenetration(config, 42, 3));
    expect(first).toBeGreaterThanOrEqual(0.68);
    expect(first).toBeLessThanOrEqual(0.78);
    expect(first).not.toBe(resolvePenetration(config, 42, 4));
  });

  it("samples only valid historical observations and falls back when empty", () => {
    const config = {
      mode: "observed_distribution" as const,
      observations: [
        {
          penetration: 0.7,
          observedAt: "2025-01-01",
          sourceType: "community" as const,
          confidence: "low" as const
        },
        {
          penetration: 0.8,
          observedAt: "2025-02-01",
          sourceType: "published" as const,
          confidence: "medium" as const
        }
      ],
      fallbackPenetration: 0.72
    };
    expect([0.7, 0.8]).toContain(resolvePenetration(config, 9, 0));
    expect(resolvePenetration({ ...config, observations: [] }, 9, 0)).toBe(
      0.72
    );
  });

  it("rejects malformed fixed, range, observation, and fallback values", () => {
    expect(() =>
      resolvePenetration({ mode: "fixed", penetration: 1 }, 1, 0)
    ).toThrow("Penetration");
    expect(() =>
      resolvePenetration(
        { mode: "range", minPenetration: 0.8, maxPenetration: 0.7 },
        1,
        0
      )
    ).toThrow("range");
    expect(() =>
      resolvePenetration(
        {
          mode: "observed_distribution",
          observations: [],
          fallbackPenetration: 0
        },
        1,
        0
      )
    ).toThrow("fallback");
    expect(() =>
      resolvePenetration(
        {
          mode: "observed_distribution",
          observations: [
            {
              penetration: 1.2,
              observedAt: "2025-01-01",
              sourceType: "community",
              confidence: "low"
            }
          ],
          fallbackPenetration: 0.72
        },
        1,
        0
      )
    ).toThrow("observation");
  });
});
