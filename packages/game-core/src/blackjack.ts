import type { Card, HandValue, Outcome, Rank } from "./types";

const CARD_VALUES: Readonly<Record<Rank, number>> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10
};

export function evaluateHand(
  cards: readonly Card[],
  options: { readonly naturalEligible?: boolean } = {}
): HandValue {
  let total = 0;
  let acesAsEleven = 0;

  for (const card of cards) {
    total += CARD_VALUES[card.rank];
    if (card.rank === "A") {
      acesAsEleven += 1;
    }
  }

  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven -= 1;
  }

  return {
    total,
    soft: acesAsEleven > 0,
    blackjack:
      (options.naturalEligible ?? true) && cards.length === 2 && total === 21,
    bust: total > 21
  };
}

export function dealerShouldHit(
  cards: readonly Card[],
  hitsSoft17 = true
): boolean {
  const hand = evaluateHand(cards);
  return hand.total < 17 || (hand.total === 17 && hand.soft && hitsSoft17);
}

export function resolveOutcome(
  playerCards: readonly Card[],
  dealerCards: readonly Card[],
  options: { readonly playerNaturalEligible?: boolean } = {}
): Outcome {
  const player =
    options.playerNaturalEligible === undefined
      ? evaluateHand(playerCards)
      : evaluateHand(playerCards, {
          naturalEligible: options.playerNaturalEligible
        });
  const dealer = evaluateHand(dealerCards);

  if (player.bust) return "loss";
  if (player.blackjack && dealer.blackjack) return "push";
  if (player.blackjack) return "blackjack";
  if (dealer.blackjack) return "loss";
  if (dealer.bust) return "win";
  if (player.total > dealer.total) return "win";
  if (player.total < dealer.total) return "loss";
  return "push";
}
