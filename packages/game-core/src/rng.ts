/** Versioned, deterministic 32-bit generator. Never substitute ambient entropy. */
export const RNG_ALGORITHM = "mulberry32-v1" as const;
export const SHUFFLE_ALGORITHM = "fisher-yates-v1" as const;
export const MAX_SEED = 0xffff_ffff;

export function isValidSeed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED;
}

function mixSeed(seed: number, stream: number): number {
  let value = (seed >>> 0) ^ Math.imul(stream + 1, 0x9e3779b9);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

export function createSeededGenerator(seed: number, stream = 0): () => number {
  if (!isValidSeed(seed)) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  let value = mixSeed(seed, stream);

  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shuffleDeterministically<T>(
  items: readonly T[],
  seed: number,
  stream = 0
): T[] {
  const shuffled = [...items];
  const random = createSeededGenerator(seed, stream);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (current === undefined || swap === undefined) {
      throw new Error("Shuffle index escaped the deck boundary.");
    }
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}
