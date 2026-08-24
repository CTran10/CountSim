import { createSeededGenerator, isValidSeed } from "./rng";
import type { PenetrationConfig } from "./types";

export function isValidPenetration(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 1;
}

export function resolvePenetration(
  config: number | PenetrationConfig,
  seed: number,
  shoeNumber: number
): number {
  if (!isValidSeed(seed)) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isInteger(shoeNumber) || shoeNumber < 0) {
    throw new Error("Shoe number must be a non-negative integer.");
  }
  if (typeof config === "number") {
    if (!isValidPenetration(config)) {
      throw new Error("Penetration must be greater than 0 and less than 1.");
    }
    return config;
  }
  if (config.mode === "fixed") {
    if (!isValidPenetration(config.penetration)) {
      throw new Error("Penetration must be greater than 0 and less than 1.");
    }
    return config.penetration;
  }
  if (config.mode === "range") {
    if (
      !isValidPenetration(config.minPenetration) ||
      !isValidPenetration(config.maxPenetration) ||
      config.minPenetration > config.maxPenetration
    ) {
      throw new Error("Penetration range must be ordered within 0 and 1.");
    }
    const random = createSeededGenerator(seed, 10_000 + shoeNumber);
    return (
      config.minPenetration +
      random() * (config.maxPenetration - config.minPenetration)
    );
  }

  if (!isValidPenetration(config.fallbackPenetration)) {
    throw new Error("Observed penetration fallback must be within 0 and 1.");
  }
  if (
    config.observations.some(
      (observation) => !isValidPenetration(observation.penetration)
    )
  ) {
    throw new Error("Every penetration observation must be within 0 and 1.");
  }
  const valid = config.observations;
  if (valid.length === 0) return config.fallbackPenetration;
  const random = createSeededGenerator(seed, 20_000 + shoeNumber);
  return valid[Math.floor(random() * valid.length)]!.penetration;
}
