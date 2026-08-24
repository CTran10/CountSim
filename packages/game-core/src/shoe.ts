import {
  createSeededGenerator,
  isValidSeed,
  shuffleDeterministically
} from "./rng";
import { resolvePenetration } from "./penetration";
import {
  RANKS,
  SUITS,
  type Card,
  type PenetrationConfig,
  type ShuffleMode
} from "./types";

export interface ShoeConfig {
  readonly decks: number;
  readonly penetration: number | PenetrationConfig;
  readonly seed: number;
  readonly shoeNumber: number;
  readonly shuffleMode?: ShuffleMode;
}

export interface Shoe {
  readonly cards: readonly Card[];
  readonly cutIndex: number;
  readonly nextIndex: number;
  readonly number: number;
  readonly penetration: number;
  readonly shuffleMode: ShuffleMode;
}

function assertShoeConfig(
  config: ShoeConfig,
  resolvedPenetration: number
): void {
  if (![1, 2, 4, 6, 8].includes(config.decks)) {
    throw new Error("Deck count must be 1, 2, 4, 6, or 8.");
  }
  if (
    !Number.isFinite(resolvedPenetration) ||
    resolvedPenetration <= 0 ||
    resolvedPenetration >= 1
  ) {
    throw new Error("Penetration must be greater than 0 and less than 1.");
  }
  if (!isValidSeed(config.seed)) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isInteger(config.shoeNumber) || config.shoeNumber < 0) {
    throw new Error("Shoe number must be a non-negative integer.");
  }
  if (
    config.shuffleMode !== undefined &&
    !["perfect", "automatic", "simulated_hand", "continuous"].includes(
      config.shuffleMode
    )
  ) {
    throw new Error("Shuffle mode is not supported.");
  }
}

function shuffleCards(
  cards: readonly Card[],
  config: ShoeConfig
): readonly Card[] {
  const mode = config.shuffleMode ?? "perfect";
  if (mode === "simulated_hand") {
    return simulateHandShuffle(cards, config.seed, config.shoeNumber);
  }
  if (mode === "continuous") {
    return shuffleDeterministically(
      cards,
      (config.seed ^ 0x5c5c_5c5c) >>> 0,
      config.shoeNumber + 31
    );
  }
  return shuffleDeterministically(cards, config.seed, config.shoeNumber);
}

function riffle(cards: readonly Card[], random: () => number): readonly Card[] {
  const midpoint = Math.floor(cards.length / 2);
  const jitter = Math.floor((random() - 0.5) * cards.length * 0.12);
  const split = Math.max(1, Math.min(cards.length - 1, midpoint + jitter));
  const left = cards.slice(0, split);
  const right = cards.slice(split);
  let leftIndex = 0;
  let rightIndex = 0;
  const interleaved: Card[] = [];
  while (leftIndex < left.length || rightIndex < right.length) {
    if (leftIndex >= left.length) {
      interleaved.push(right[rightIndex++]!);
      continue;
    }
    if (rightIndex >= right.length) {
      interleaved.push(left[leftIndex++]!);
      continue;
    }
    const leftRemaining = left.length - leftIndex;
    const rightRemaining = right.length - rightIndex;
    if (random() < leftRemaining / (leftRemaining + rightRemaining)) {
      interleaved.push(left[leftIndex++]!);
    } else {
      interleaved.push(right[rightIndex++]!);
    }
  }
  return interleaved;
}

function strip(cards: readonly Card[], random: () => number): readonly Card[] {
  const packets: Card[][] = [];
  for (let index = 0; index < cards.length;) {
    const size = 3 + Math.floor(random() * 6);
    packets.unshift(cards.slice(index, index + size));
    index += size;
  }
  return packets.flat();
}

function cut(cards: readonly Card[], random: () => number): readonly Card[] {
  const cutIndex = Math.max(
    1,
    Math.min(
      cards.length - 1,
      Math.floor(cards.length * (0.3 + random() * 0.4))
    )
  );
  return [...cards.slice(cutIndex), ...cards.slice(0, cutIndex)];
}

function simulateHandShuffle(
  cards: readonly Card[],
  seed: number,
  shoeNumber: number
): readonly Card[] {
  const random = createSeededGenerator(
    (seed ^ 0xa5a5_a5a5) >>> 0,
    shoeNumber + 17
  );
  return cut(
    riffle(strip(riffle(riffle(cards, random), random), random), random),
    random
  );
}

export function createShoe(config: ShoeConfig): Shoe {
  const penetration = resolvePenetration(
    config.penetration,
    config.seed,
    config.shoeNumber
  );
  assertShoeConfig(config, penetration);
  const cards: Card[] = [];

  for (let deck = 0; deck < config.decks; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `shoe-${config.shoeNumber}-deck-${deck}-${suit}-${rank}`,
          rank,
          suit
        });
      }
    }
  }

  return {
    cards: shuffleCards(cards, config),
    cutIndex: Math.floor(cards.length * penetration),
    nextIndex: 0,
    number: config.shoeNumber,
    penetration,
    shuffleMode: config.shuffleMode ?? "perfect"
  };
}

export function drawCard(shoe: Shoe): {
  readonly card: Card;
  readonly shoe: Shoe;
} {
  const card = shoe.cards[shoe.nextIndex];
  if (card === undefined) {
    throw new Error(
      "The shoe does not contain enough cards to finish the round."
    );
  }

  return {
    card,
    shoe: { ...shoe, nextIndex: shoe.nextIndex + 1 }
  };
}
