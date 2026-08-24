import { evaluateHand } from "./blackjack";
import type { Card, GameRules, Rank } from "./types";

export type PlayerAction =
  "hit" | "stand" | "double" | "split" | "surrender" | "insurance";

export type StrategyHandType = "hard" | "soft" | "pair";

export interface StrategyDecisionInput {
  readonly playerCards: readonly Card[];
  readonly dealerUpCard: Card;
  readonly rules: GameRules;
  readonly afterSplit?: boolean;
  readonly splitAces?: boolean;
  readonly splitHands?: number;
  readonly canDouble?: boolean;
  readonly canSplit?: boolean;
  readonly canSurrender?: boolean;
}

export interface StrategyDecision {
  readonly algorithmVersion: "basic-strategy-v1";
  readonly rulesetId: string;
  readonly action: PlayerAction;
  readonly preferredAction: PlayerAction;
  readonly fallbackAction?: PlayerAction;
  readonly availableActions: readonly PlayerAction[];
  readonly playerTotal: number;
  readonly handType: StrategyHandType;
  readonly explanation: string;
}

interface Candidate {
  readonly action: PlayerAction;
  readonly fallback?: "hit" | "stand";
  readonly reason: string;
}

const TEN_VALUE_RANKS: readonly Rank[] = ["10", "J", "Q", "K"];

function dealerValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (TEN_VALUE_RANKS.includes(rank)) return 10;
  return Number(rank);
}

function pairValue(cards: readonly Card[]): number | undefined {
  if (cards.length !== 2) return undefined;
  const first = dealerValue(cards[0]!.rank);
  const second = dealerValue(cards[1]!.rank);
  return first === second ? first : undefined;
}

function canDoubleByRule(input: StrategyDecisionInput): boolean {
  if (input.playerCards.length !== 2 || input.canDouble === false) return false;
  if (input.afterSplit && !input.rules.doubleAfterSplit) return false;
  if (input.splitAces && !input.rules.doubleSplitAces) return false;

  const total = evaluateHand(input.playerCards).total;
  if (input.rules.doubleRule === "any_two") return true;
  if (input.rules.doubleRule === "10_11") return total === 10 || total === 11;
  return total >= 9 && total <= 11;
}

function canSplitByRule(input: StrategyDecisionInput): boolean {
  const value = pairValue(input.playerCards);
  if (value === undefined || input.canSplit === false) return false;
  if ((input.splitHands ?? 1) >= input.rules.maxSplitHands) return false;
  if (input.afterSplit && value === 11 && !input.rules.resplitAces)
    return false;
  return true;
}

function canSurrenderByRule(input: StrategyDecisionInput): boolean {
  return (
    input.playerCards.length === 2 &&
    !input.afterSplit &&
    input.canSurrender !== false &&
    input.rules.surrender !== "none"
  );
}

export function getAvailableActions(
  input: StrategyDecisionInput
): readonly PlayerAction[] {
  if (input.playerCards.length === 0) {
    throw new Error("A strategy decision requires at least one player card.");
  }

  const actions: PlayerAction[] = ["hit", "stand"];
  if (canDoubleByRule(input)) actions.push("double");
  if (canSplitByRule(input)) actions.push("split");
  if (canSurrenderByRule(input)) actions.push("surrender");
  if (input.dealerUpCard.rank === "A") actions.push("insurance");
  return actions;
}

function surrenderCandidate(
  input: StrategyDecisionInput,
  total: number,
  dealer: number
): Candidate | undefined {
  if (!canSurrenderByRule(input)) return undefined;

  const pair = pairValue(input.playerCards);
  const values = input.playerCards
    .map((card) => dealerValue(card.rank))
    .sort((left, right) => left - right);
  const isComposition = (left: number, right: number) =>
    values[0] === Math.min(left, right) && values[1] === Math.max(left, right);

  if (input.rules.surrender === "early") {
    const singleDeckTenException =
      input.rules.decks === 1 && (isComposition(4, 10) || isComposition(5, 9));
    const doubleDeckTenException =
      input.rules.decks === 2 && isComposition(4, 10);
    const splitEightsException =
      input.rules.decks === 1 && input.rules.doubleAfterSplit && pair === 8;
    const versusTen =
      dealer === 10 &&
      total >= 14 &&
      total <= 16 &&
      !singleDeckTenException &&
      !doubleDeckTenException &&
      !splitEightsException;
    const versusAce =
      dealer === 11 &&
      ((total >= 5 && total <= 7) ||
        (total >= 12 && total <= 17) ||
        (pair === 2 && input.rules.dealerSoft17 === "H17"));
    if (versusTen || versusAce) {
      return {
        action: "surrender",
        reason:
          "Early surrender preserves half the wager before the dealer checks for blackjack."
      };
    }
    return undefined;
  }

  let late = false;
  if (input.rules.decks === 1) {
    late =
      (dealer === 10 &&
        (pair === 7 ||
          isComposition(9, 6) ||
          isComposition(10, 5) ||
          (total === 16 && pair !== 8))) ||
      (dealer === 11 &&
        (input.rules.dealerSoft17 === "S17"
          ? isComposition(10, 6)
          : pair === 7 ||
            isComposition(9, 6) ||
            isComposition(10, 5) ||
            isComposition(9, 7) ||
            isComposition(10, 6) ||
            isComposition(10, 7)));
  } else if (input.rules.decks === 2) {
    late =
      (dealer === 10 &&
        (isComposition(9, 6) ||
          isComposition(10, 5) ||
          (total === 16 && pair !== 8))) ||
      (dealer === 11 &&
        (input.rules.dealerSoft17 === "S17"
          ? total === 16 && pair !== 8
          : isComposition(9, 6) ||
            isComposition(10, 5) ||
            isComposition(9, 7) ||
            isComposition(10, 6) ||
            total === 17 ||
            (pair === 8 && !input.rules.doubleAfterSplit)));
  } else if (input.rules.decks < 8) {
    late =
      (dealer === 9 && total === 16 && pair !== 8) ||
      (dealer === 10 &&
        (isComposition(9, 6) ||
          isComposition(10, 5) ||
          (total === 16 && pair !== 8))) ||
      (dealer === 11 &&
        (input.rules.dealerSoft17 === "S17"
          ? total === 16 && pair !== 8
          : total === 15 || total === 17 || total === 16));
  } else {
    late =
      (pair === 8
        ? dealer === 11 && input.rules.dealerSoft17 === "H17"
        : total === 16 && dealer >= 9) ||
      (total === 15 && dealer === 10) ||
      (input.rules.dealerSoft17 === "H17" &&
        dealer === 11 &&
        (total === 15 || total === 17));
  }
  if (!late) return undefined;

  return {
    action: "surrender",
    reason: `Late surrender loses less than playing this composition against the dealer's ${input.dealerUpCard.rank}.`
  };
}

function pairCandidate(
  input: StrategyDecisionInput,
  value: number,
  dealer: number
): Candidate {
  if (value === 11) {
    return {
      action: "split",
      fallback: "hit",
      reason: "Split aces to start two hands with the strongest first card."
    };
  }
  if (value === 10) {
    return {
      action: "stand",
      reason: "A made 20 is stronger than two new hands."
    };
  }
  if (value === 9) {
    const shouldSplit =
      (dealer >= 2 && dealer <= 9 && dealer !== 7) ||
      (input.rules.decks === 1 &&
        dealer === 11 &&
        input.rules.dealerSoft17 === "H17" &&
        input.rules.doubleAfterSplit);
    return shouldSplit
      ? {
          action: "split",
          fallback: "stand",
          reason:
            "Split nines against this dealer range to create two strong starting hands."
        }
      : { action: "stand", reason: "Keep 18 against this dealer upcard." };
  }
  if (value === 8) {
    return {
      action: "split",
      fallback: "hit",
      reason:
        "Two eights make a weak 16; splitting gives each hand room to improve."
    };
  }
  if (value === 7) {
    const upper =
      input.rules.decks === 1
        ? input.rules.doubleAfterSplit
          ? 8
          : 7
        : input.rules.decks === 2
          ? 8
          : 7;
    return dealer >= 2 && dealer <= upper
      ? {
          action: "split",
          fallback: "hit",
          reason: `The ${input.rules.decks <= 2 ? "double-deck" : "shoe"} chart splits sevens through dealer ${upper}.`
        }
      : {
          action: "hit",
          reason: "Keep the pair together and improve hard 14."
        };
  }
  if (value === 6) {
    if (input.rules.decks === 1) {
      const upper = input.rules.doubleAfterSplit ? 7 : 6;
      return dealer >= 2 && dealer <= upper
        ? {
            action: "split",
            fallback: "hit",
            reason:
              "Single-deck strategy splits sixes across this dealer range."
          }
        : { action: "hit", reason: "Play the pair as hard 12 here." };
    }
    const lower = input.rules.doubleAfterSplit ? 2 : 3;
    const upper =
      input.rules.decks <= 2 && input.rules.doubleAfterSplit ? 7 : 6;
    return dealer >= lower && dealer <= upper
      ? {
          action: "split",
          fallback: "hit",
          reason:
            "Splitting sixes is supported by this deck and double-after-split rule set."
        }
      : {
          action: "hit",
          reason: "Play the pair as hard 12 under these split rules."
        };
  }
  if (value === 5) {
    return hardCandidate(input, 10, dealer);
  }
  if (value === 4) {
    if (input.rules.decks === 1) {
      const shouldSplit =
        input.rules.doubleAfterSplit && dealer >= 4 && dealer <= 6;
      return shouldSplit
        ? {
            action: "split",
            reason:
              "Single-deck DAS strategy splits fours against dealer 4 through 6."
          }
        : hardCandidate(input, 8, dealer);
    }
    return input.rules.doubleAfterSplit && (dealer === 5 || dealer === 6)
      ? {
          action: "split",
          fallback: "hit",
          reason:
            "Double after split makes two fours profitable against dealer 5 or 6."
        }
      : {
          action: "hit",
          reason:
            "Keep the fours together when split doubles are not favorable."
        };
  }

  const lower =
    input.rules.decks === 1 && value === 3 && !input.rules.doubleAfterSplit
      ? 4
      : input.rules.doubleAfterSplit
        ? 2
        : input.rules.decks <= 2
          ? 3
          : 4;
  const upper =
    input.rules.decks === 1 && value === 3 && input.rules.doubleAfterSplit
      ? 8
      : 7;
  return dealer >= lower && dealer <= upper
    ? {
        action: "split",
        fallback: "hit",
        reason:
          "Split small pairs where dealer weakness and follow-up doubling support it."
      }
    : {
        action: "hit",
        reason: "Keep the small pair together against this upcard."
      };
}

function softCandidate(
  input: StrategyDecisionInput,
  total: number,
  dealer: number
): Candidate {
  if (total >= 20)
    return { action: "stand", reason: `Soft ${total} is already strong.` };
  if (total === 19) {
    if (input.rules.dealerSoft17 === "H17" && dealer === 6) {
      return {
        action: "double",
        fallback: "stand",
        reason: "H17 adds the soft 19 double against dealer 6."
      };
    }
    return { action: "stand", reason: "Soft 19 is a standing hand under S17." };
  }
  if (total === 18) {
    if (input.rules.decks === 1) {
      if (dealer >= 3 && dealer <= 6) {
        return {
          action: "double",
          fallback: "stand",
          reason: "Single-deck soft 18 doubles against dealer 3 through 6."
        };
      }
      if (
        dealer === 2 ||
        dealer === 7 ||
        dealer === 8 ||
        (dealer === 11 && input.rules.dealerSoft17 === "S17")
      ) {
        return { action: "stand", reason: "Soft 18 stands here." };
      }
      return { action: "hit", reason: "Soft 18 needs improvement here." };
    }
    const lower =
      input.rules.dealerSoft17 === "H17" || input.rules.decks <= 2 ? 2 : 3;
    if (dealer >= lower && dealer <= 6) {
      return {
        action: "double",
        fallback: "stand",
        reason:
          "Soft 18 presses the wager against a weak dealer while retaining a safe fallback."
      };
    }
    if (dealer === 7 || dealer === 8 || (dealer === 2 && lower === 3)) {
      return { action: "stand", reason: "Soft 18 stands against this upcard." };
    }
    return {
      action: "hit",
      reason: "Soft 18 needs improvement against a strong dealer."
    };
  }
  if (total === 17) {
    const lower = input.rules.decks <= 2 ? 2 : 3;
    return dealer >= lower && dealer <= 6
      ? {
          action: "double",
          fallback: "hit",
          reason: "Soft 17 doubles inside this deck-specific weak-dealer range."
        }
      : {
          action: "hit",
          reason: "Soft 17 can take another card without an immediate bust."
        };
  }
  if (total === 16 || total === 15) {
    return dealer >= 4 && dealer <= 6
      ? {
          action: "double",
          fallback: "hit",
          reason: `Soft ${total} doubles against dealer 4 through 6.`
        }
      : { action: "hit", reason: `Soft ${total} needs another card.` };
  }
  if (total === 14 || total === 13) {
    return (input.rules.decks === 1 && dealer >= 4 && dealer <= 6) ||
      dealer === 5 ||
      dealer === 6
      ? {
          action: "double",
          fallback: "hit",
          reason: `Soft ${total} doubles only against dealer 5 or 6.`
        }
      : { action: "hit", reason: `Soft ${total} needs another card.` };
  }
  return { action: "hit", reason: "This soft total can draw safely." };
}

function hardCandidate(
  input: StrategyDecisionInput,
  total: number,
  dealer: number
): Candidate {
  if (total >= 17)
    return { action: "stand", reason: `Hard ${total} is a standing total.` };
  if (total >= 13) {
    return dealer >= 2 && dealer <= 6
      ? {
          action: "stand",
          reason: "Let a weak dealer draw against this stiff total."
        }
      : {
          action: "hit",
          reason: "A strong dealer upcard makes hitting the lower-loss play."
        };
  }
  if (total === 12) {
    return dealer >= 4 && dealer <= 6
      ? {
          action: "stand",
          reason: "Stand hard 12 only against dealer 4 through 6."
        }
      : {
          action: "hit",
          reason: "Hard 12 is too weak to stand against this upcard."
        };
  }
  if (total === 11) {
    const s17Ace =
      input.rules.decks >= 4 &&
      input.rules.dealerSoft17 === "S17" &&
      dealer === 11;
    return s17Ace
      ? { action: "hit", reason: "S17 shoe strategy hits 11 against an ace." }
      : {
          action: "double",
          fallback: "hit",
          reason:
            "Hard 11 has the strongest one-card double opportunity in this rule set."
        };
  }
  if (total === 10) {
    return dealer >= 2 && dealer <= 9
      ? {
          action: "double",
          fallback: "hit",
          reason: "Hard 10 doubles against dealer 2 through 9."
        }
      : {
          action: "hit",
          reason: "Hit hard 10 against a ten-value card or ace."
        };
  }
  if (total === 9) {
    const lower = input.rules.decks <= 2 ? 2 : 3;
    return dealer >= lower && dealer <= 6
      ? {
          action: "double",
          fallback: "hit",
          reason: `${input.rules.decks <= 2 ? "Double-deck" : "Shoe"} strategy doubles hard 9 from dealer ${lower} through 6.`
        }
      : {
          action: "hit",
          reason: "Hard 9 falls outside this game's doubling range."
        };
  }
  if (
    total === 8 &&
    input.rules.decks === 1 &&
    (dealer === 5 || dealer === 6)
  ) {
    return {
      action: "double",
      fallback: "hit",
      reason: "Single-deck strategy doubles hard 8 against dealer 5 or 6."
    };
  }
  return { action: "hit", reason: `Hard ${total} needs another card.` };
}

function baseCandidate(
  input: StrategyDecisionInput,
  options: { readonly allowSurrender: boolean; readonly allowPair: boolean }
): Candidate {
  const hand = evaluateHand(input.playerCards);
  const dealer = dealerValue(input.dealerUpCard.rank);

  if (options.allowSurrender) {
    const surrender = surrenderCandidate(input, hand.total, dealer);
    if (surrender !== undefined) return surrender;
  }

  const pair = pairValue(input.playerCards);
  if (options.allowPair && pair !== undefined) {
    return pairCandidate(input, pair, dealer);
  }
  if (hand.soft) return softCandidate(input, hand.total, dealer);
  return hardCandidate(input, hand.total, dealer);
}

function resolveFallback(
  input: StrategyDecisionInput,
  candidate: Candidate
): PlayerAction {
  if (candidate.fallback !== undefined) return candidate.fallback;
  if (candidate.action === "surrender") {
    const withoutSurrender = baseCandidate(input, {
      allowSurrender: false,
      allowPair: true
    });
    if (withoutSurrender.action === "split") return "split";
    return (
      withoutSurrender.fallback ??
      (withoutSurrender.action === "stand" ? "stand" : "hit")
    );
  }
  if (candidate.action === "split") {
    const withoutPair = baseCandidate(input, {
      allowSurrender: false,
      allowPair: false
    });
    if (getAvailableActions(input).includes(withoutPair.action)) {
      return withoutPair.action;
    }
    return (
      withoutPair.fallback ?? (withoutPair.action === "stand" ? "stand" : "hit")
    );
  }
  return candidate.action === "stand" ? "stand" : "hit";
}

export function recommendBasicStrategy(
  input: StrategyDecisionInput
): StrategyDecision {
  const availableActions = getAvailableActions(input);
  const hand = evaluateHand(input.playerCards);
  const pair = pairValue(input.playerCards);
  const candidate = baseCandidate(input, {
    allowSurrender: true,
    allowPair: true
  });
  const actionAvailable = availableActions.includes(candidate.action);
  const fallbackAction = actionAvailable
    ? undefined
    : resolveFallback(input, candidate);
  const action = actionAvailable ? candidate.action : fallbackAction!;

  return {
    algorithmVersion: "basic-strategy-v1",
    rulesetId: [
      `${input.rules.decks}D`,
      input.rules.blackjackPayout,
      input.rules.dealerSoft17,
      input.rules.doubleAfterSplit ? "DAS" : "NDAS",
      input.rules.surrender,
      input.rules.resplitAces ? "RSA" : "NRSA"
    ].join("-"),
    action,
    preferredAction: candidate.action,
    ...(fallbackAction === undefined ? {} : { fallbackAction }),
    availableActions,
    playerTotal: hand.total,
    handType: pair === undefined ? (hand.soft ? "soft" : "hard") : "pair",
    explanation: actionAvailable
      ? candidate.reason
      : `${candidate.reason} ${candidate.action[0]!.toUpperCase()}${candidate.action.slice(1)} is not available, so ${action} instead.`
  };
}
