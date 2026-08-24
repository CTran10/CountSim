import { dealerShouldHit, evaluateHand } from "./blackjack";
import { calculateTrueCount, hiLoValue } from "./counting";
import {
  evaluateDeviation,
  evaluateInsuranceDeviation,
  type DeviationProfile
} from "./deviations";
import { isValidSeed, shuffleDeterministically } from "./rng";
import type { PlayerAction } from "./strategy";
import { RANKS, SUITS, type Card, type GameRules, type Outcome } from "./types";

export interface SimulationRoundRecord {
  readonly roundNumber: number;
  readonly outcomes: readonly Outcome[];
  readonly initialTrueCount: number;
  readonly decisionTrueCounts: readonly number[];
  readonly deviationOpportunities: number;
  readonly deviationsTriggered: number;
}

export interface SimulationMetrics {
  readonly rounds: number;
  readonly hands: number;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly blackjacks: number;
  readonly surrenders: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly trueCountThresholdOpportunities: number;
  readonly deviationOpportunities: number;
  readonly deviationsTriggered: number;
  readonly deviationCaptureRate: number;
}

export interface DeterministicSimulationInput {
  readonly seed: number;
  readonly rounds: number;
  readonly rules: GameRules;
  readonly profile?: string | DeviationProfile;
  readonly penetration?: number;
  readonly trueCountThreshold?: number;
}

export interface DeterministicSimulationResult {
  readonly seed: number;
  readonly profileId: string;
  readonly records: readonly SimulationRoundRecord[];
  readonly metrics: SimulationMetrics;
}

interface LocalShoe {
  readonly cards: readonly Card[];
  readonly cutIndex: number;
  nextIndex: number;
  runningCount: number;
  readonly number: number;
}

interface SimulatedHand {
  cards: Card[];
  readonly afterSplit: boolean;
  readonly splitAces: boolean;
  readonly naturalEligible: boolean;
  surrendered: boolean;
}

interface RoundCounters {
  readonly decisionTrueCounts: number[];
  deviationOpportunities: number;
  deviationsTriggered: number;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function summarizeSimulation(
  records: readonly SimulationRoundRecord[],
  trueCountThreshold = 1
): SimulationMetrics {
  if (!Number.isFinite(trueCountThreshold)) {
    throw new Error("True count threshold must be finite.");
  }

  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let blackjacks = 0;
  let surrenders = 0;
  let trueCountThresholdOpportunities = 0;
  let deviationOpportunities = 0;
  let deviationsTriggered = 0;

  for (const record of records) {
    for (const outcome of record.outcomes) {
      if (outcome === "win") wins += 1;
      if (outcome === "loss") losses += 1;
      if (outcome === "push") pushes += 1;
      if (outcome === "blackjack") blackjacks += 1;
      if (outcome === "surrender") surrenders += 1;
    }
    trueCountThresholdOpportunities += record.decisionTrueCounts.filter(
      (trueCount) => trueCount >= trueCountThreshold
    ).length;
    deviationOpportunities += record.deviationOpportunities;
    deviationsTriggered += record.deviationsTriggered;
  }

  const hands = wins + losses + pushes + blackjacks + surrenders;
  return {
    rounds: records.length,
    hands,
    wins,
    losses,
    pushes,
    blackjacks,
    surrenders,
    winRate: safeRate(wins + blackjacks, hands),
    lossRate: safeRate(losses + surrenders, hands),
    trueCountThresholdOpportunities,
    deviationOpportunities,
    deviationsTriggered,
    deviationCaptureRate: safeRate(deviationsTriggered, deviationOpportunities)
  };
}

function createLocalShoe(
  seed: number,
  shoeNumber: number,
  rules: GameRules,
  penetration: number
): LocalShoe {
  const cards: Card[] = [];
  for (let deck = 0; deck < rules.decks; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `simulation-${shoeNumber}-${deck}-${suit}-${rank}`,
          rank,
          suit
        });
      }
    }
  }

  const shoe = {
    cards: shuffleDeterministically(cards, seed, shoeNumber),
    cutIndex: Math.floor(cards.length * penetration),
    nextIndex: 0,
    runningCount: 0,
    number: shoeNumber
  };
  if (rules.burnCard) shoe.nextIndex = 1;
  return shoe;
}

function draw(shoe: LocalShoe): Card {
  const card = shoe.cards[shoe.nextIndex];
  if (card === undefined) {
    throw new Error("Simulation exhausted the shoe while resolving a round.");
  }
  shoe.nextIndex += 1;
  return card;
}

function expose(shoe: LocalShoe, card: Card): void {
  shoe.runningCount += hiLoValue(card);
}

function drawExposed(shoe: LocalShoe): Card {
  const card = draw(shoe);
  expose(shoe, card);
  return card;
}

function currentTrueCount(shoe: LocalShoe): number {
  return calculateTrueCount({
    runningCount: shoe.runningCount,
    cardsRemaining: shoe.cards.length - shoe.nextIndex,
    estimation: "half",
    resolution: "truncate"
  }).trueCountResolved;
}

function defaultProfileId(rules: GameRules): string {
  if (rules.decks === 2 && rules.dealerSoft17 === "H17") {
    return "hi-lo-dd-h17";
  }
  return rules.dealerSoft17 === "H17" ? "hi-lo-shoe-h17" : "hi-lo-shoe-s17";
}

function profileId(profile: string | DeviationProfile): string {
  return typeof profile === "string" ? profile : profile.id;
}

function decide(
  hand: SimulatedHand,
  dealerUpCard: Card,
  shoe: LocalShoe,
  rules: GameRules,
  profile: string | DeviationProfile,
  splitHands: number,
  counters: RoundCounters
): PlayerAction {
  const trueCount = currentTrueCount(shoe);
  counters.decisionTrueCounts.push(trueCount);
  const decision = evaluateDeviation({
    playerCards: hand.cards,
    dealerUpCard,
    rules,
    afterSplit: hand.afterSplit,
    splitAces: hand.splitAces,
    splitHands,
    profile,
    trueCount
  });

  if (decision.opportunity && decision.eligible) {
    counters.deviationOpportunities += 1;
    if (
      decision.thresholdMet &&
      decision.entry !== undefined &&
      decision.action === decision.entry.action
    ) {
      counters.deviationsTriggered += 1;
    }
  }
  return decision.action;
}

function resolvePlayedHand(
  hand: SimulatedHand,
  dealerCards: readonly Card[]
): Outcome {
  if (hand.surrendered) return "surrender";
  const player = evaluateHand(hand.cards);
  const dealer = evaluateHand(dealerCards);
  if (player.bust) return "loss";
  if (hand.naturalEligible && player.blackjack && dealer.blackjack)
    return "push";
  if (hand.naturalEligible && player.blackjack) return "blackjack";
  if (dealer.blackjack) return "loss";
  if (dealer.bust) return "win";
  if (player.total > dealer.total) return "win";
  if (player.total < dealer.total) return "loss";
  return "push";
}

function playRound(
  roundNumber: number,
  shoe: LocalShoe,
  rules: GameRules,
  profile: string | DeviationProfile
): SimulationRoundRecord {
  const firstPlayer = drawExposed(shoe);
  const dealerUpCard = drawExposed(shoe);
  const secondPlayer = drawExposed(shoe);
  const dealerHoleCard = draw(shoe);
  const initialTrueCount = currentTrueCount(shoe);
  const counters: RoundCounters = {
    decisionTrueCounts: [],
    deviationOpportunities: 0,
    deviationsTriggered: 0
  };

  if (dealerUpCard.rank === "A") {
    const insuranceTrueCount = currentTrueCount(shoe);
    counters.decisionTrueCounts.push(insuranceTrueCount);
    const insurance = evaluateInsuranceDeviation({
      profile,
      rules,
      trueCount: insuranceTrueCount
    });
    if (insurance.eligible) {
      counters.deviationOpportunities += 1;
      if (insurance.thresholdMet && insurance.action === "insurance") {
        counters.deviationsTriggered += 1;
      }
    }
  }

  const initialPlayerCards = [firstPlayer, secondPlayer];
  const dealerCards = [dealerUpCard, dealerHoleCard];
  const playerNatural = evaluateHand(initialPlayerCards).blackjack;
  const dealerNatural = evaluateHand(dealerCards).blackjack;

  if (playerNatural || (dealerNatural && rules.dealerPeek)) {
    expose(shoe, dealerHoleCard);
    return {
      roundNumber,
      outcomes: [
        resolvePlayedHand(
          {
            cards: initialPlayerCards,
            afterSplit: false,
            splitAces: false,
            naturalEligible: true,
            surrendered: false
          },
          dealerCards
        )
      ],
      initialTrueCount,
      decisionTrueCounts: counters.decisionTrueCounts,
      deviationOpportunities: counters.deviationOpportunities,
      deviationsTriggered: counters.deviationsTriggered
    };
  }

  const queue: SimulatedHand[] = [
    {
      cards: initialPlayerCards,
      afterSplit: false,
      splitAces: false,
      naturalEligible: true,
      surrendered: false
    }
  ];
  const completed: SimulatedHand[] = [];
  let splitHands = 1;

  while (queue.length > 0) {
    const hand = queue.shift()!;
    let replacedBySplit = false;

    while (!evaluateHand(hand.cards).bust) {
      const pairOfAces =
        hand.cards.length === 2 &&
        hand.cards[0]!.rank === "A" &&
        hand.cards[1]!.rank === "A";
      if (hand.splitAces && !rules.hitSplitAces && !pairOfAces) break;

      const action = decide(
        hand,
        dealerUpCard,
        shoe,
        rules,
        profile,
        splitHands,
        counters
      );
      if (action === "stand") break;
      if (action === "surrender") {
        hand.surrendered = true;
        break;
      }
      if (action === "double") {
        hand.cards.push(drawExposed(shoe));
        break;
      }
      if (action === "split") {
        const left = hand.cards[0]!;
        const right = hand.cards[1]!;
        const splitAces = left.rank === "A" && right.rank === "A";
        splitHands += 1;
        queue.unshift(
          {
            cards: [right, drawExposed(shoe)],
            afterSplit: true,
            splitAces,
            naturalEligible: false,
            surrendered: false
          },
          {
            cards: [left, drawExposed(shoe)],
            afterSplit: true,
            splitAces,
            naturalEligible: false,
            surrendered: false
          }
        );
        replacedBySplit = true;
        break;
      }
      hand.cards.push(drawExposed(shoe));
    }

    if (!replacedBySplit) completed.push(hand);
  }

  const dealerMustPlay = completed.some(
    (hand) => !hand.surrendered && !evaluateHand(hand.cards).bust
  );
  if (dealerMustPlay) {
    expose(shoe, dealerHoleCard);
    while (dealerShouldHit(dealerCards, rules.dealerSoft17 === "H17")) {
      dealerCards.push(drawExposed(shoe));
    }
  }

  return {
    roundNumber,
    outcomes: completed.map((hand) => resolvePlayedHand(hand, dealerCards)),
    initialTrueCount,
    decisionTrueCounts: counters.decisionTrueCounts,
    deviationOpportunities: counters.deviationOpportunities,
    deviationsTriggered: counters.deviationsTriggered
  };
}

export function runDeterministicSimulation(
  input: DeterministicSimulationInput
): DeterministicSimulationResult {
  if (!isValidSeed(input.seed)) {
    throw new Error("Simulation seed must be an unsigned 32-bit integer.");
  }
  if (
    !Number.isInteger(input.rounds) ||
    input.rounds <= 0 ||
    input.rounds > 100_000
  ) {
    throw new Error("Simulation rounds must be between 1 and 100000.");
  }
  const penetration = input.penetration ?? 0.75;
  if (!Number.isFinite(penetration) || penetration <= 0 || penetration >= 1) {
    throw new Error("Penetration must be greater than 0 and less than 1.");
  }
  const trueCountThreshold = input.trueCountThreshold ?? 1;
  if (!Number.isFinite(trueCountThreshold)) {
    throw new Error("True count threshold must be finite.");
  }

  const profile = input.profile ?? defaultProfileId(input.rules);
  const records: SimulationRoundRecord[] = [];
  let shoeNumber = 0;
  let shoe = createLocalShoe(input.seed, shoeNumber, input.rules, penetration);

  for (let roundNumber = 1; roundNumber <= input.rounds; roundNumber += 1) {
    const cardsRemaining = shoe.cards.length - shoe.nextIndex;
    if (shoe.nextIndex >= shoe.cutIndex || cardsRemaining < 30) {
      shoeNumber += 1;
      shoe = createLocalShoe(input.seed, shoeNumber, input.rules, penetration);
    }
    records.push(playRound(roundNumber, shoe, input.rules, profile));
  }

  return {
    seed: input.seed,
    profileId: profileId(profile),
    records,
    metrics: summarizeSimulation(records, trueCountThreshold)
  };
}
