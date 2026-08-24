import { isValidSeed } from "@trueedge/game-core";

export const DEFAULT_SEED = 785390425;

type RandomValuesSource = (values: Uint32Array) => void;

export function generateSessionSeed(
  fillRandomValues: RandomValuesSource = (values) => {
    globalThis.crypto.getRandomValues(values);
  }
): number {
  const values = new Uint32Array(1);
  fillRandomValues(values);
  return values[0]!;
}

export function readSeed(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined || candidate.trim() === "") return DEFAULT_SEED;
  const parsed = Number(candidate);
  return isValidSeed(parsed) ? parsed : DEFAULT_SEED;
}
