import type { Card, Rank, Suit } from "@trueedge/game-core";

const RANK_NAMES: Readonly<Record<Rank, string>> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King"
};

const SUIT_INITIAL: Readonly<Record<Suit, string>> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S"
};

export function formatCents(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(cents / 100)}`;
}

export function cardAsset(card: Card): string {
  return `/cards/${card.rank}${SUIT_INITIAL[card.suit]}.svg`;
}

export function cardLabel(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${card.suit}`;
}
