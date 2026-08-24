import { describe, expect, it } from "vitest";

import {
  DEFAULT_SESSION_CONFIG,
  applyCommand,
  createSession,
  evaluateHand,
  exportReplay,
  hiLoValue,
  replaySession,
  selectTableView,
  createShoe,
  type Card,
  type SessionCommand,
  type SessionConfig,
  type SessionState,
  type Outcome,
  type Rank
} from "../src/index";

function accept(state: SessionState, command: SessionCommand): SessionState {
  const result = applyCommand(state, command);
  expect(result.ok).toBe(true);
  return result.state;
}

function completeRound(config: SessionConfig, wagerCents = 500): SessionState {
  let state = createSession(config);
  state = accept(state, { type: "place_bet", amountCents: wagerCents });
  state = accept(state, { type: "deal" });
  if (state.phase === "player") {
    state = accept(state, { type: "stand" });
  }
  return state;
}

function findRoundWithOutcome(outcome: Outcome): SessionState {
  for (let seed = 0; seed <= 2_000; seed += 1) {
    const state = completeRound({ ...DEFAULT_SESSION_CONFIG, seed });
    if (state.round?.result?.outcome === outcome) return state;
  }
  throw new Error(`No deterministic ${outcome} fixture was found.`);
}

describe("deterministic session", () => {
  it("rejects an illegal command without changing state", () => {
    const state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 785390425
    });
    const result = applyCommand(state, { type: "stand" });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.error).toBe(
      "Stand is only available during the player turn."
    );
  });

  it("deals two player cards, hides the dealer hole card, and counts three exposures", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 785390425
    });
    state = applyCommand(state, { type: "place_bet", amountCents: 2500 }).state;
    const dealt = applyCommand(state, { type: "deal" });
    const view = selectTableView(dealt.state);

    expect(dealt.ok).toBe(true);
    expect(view.playerCards).toHaveLength(2);
    expect(view.dealerCards).toHaveLength(2);
    expect(view.dealerCards[1]).toBeNull();
    expect(view.count.cardsSeen).toBe(3);
    expect(view.phase).toBe("player");
  });

  it("replays a completed deterministic round exactly", () => {
    let original = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 785390425
    });
    for (const command of [
      { type: "place_bet", amountCents: 2500 },
      { type: "deal" },
      { type: "stand" }
    ] as const) {
      const result = applyCommand(original, command);
      expect(result.ok).toBe(true);
      original = result.state;
    }

    const replay = exportReplay(original);
    const reproduced = replaySession(replay);

    expect(reproduced.digest).toBe(replay.finalDigest);
    expect(replay.finalDigest).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(selectTableView(reproduced.state)).toEqual(
      selectTableView(original)
    );
    expect(replay.resolvedShoeOrder).toHaveLength(312);
    expect(replay.resolvedCutIndex).toBe(234);
  });

  it("credits a natural blackjack at exactly 3:2", () => {
    const state = findRoundWithOutcome("blackjack");

    expect(state.round?.result).toMatchObject({
      outcome: "blackjack",
      wagerCents: 500,
      profitCents: 750
    });
    expect(state.bankrollCents).toBe(
      DEFAULT_SESSION_CONFIG.limits.startingBankrollCents + 750
    );
  });

  it("preserves the bankroll on a push", () => {
    const state = findRoundWithOutcome("push");

    expect(state.round?.result?.profitCents).toBe(0);
    expect(state.bankrollCents).toBe(
      DEFAULT_SESSION_CONFIG.limits.startingBankrollCents
    );
  });

  it("exposes and counts the dealer hole card exactly once", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    const holeCardId = state.round?.dealerCards[1]?.id;
    expect(holeCardId).toBeDefined();

    state = accept(state, { type: "stand" });
    expect(selectTableView(state).dealerCards[1]).not.toBeNull();
    const holeExposures = state.events.filter(
      (event) => event.type === "card_exposed" && event.card.id === holeCardId
    );
    expect(holeExposures).toHaveLength(1);

    const rejected = applyCommand(state, { type: "stand" });
    expect(rejected.ok).toBe(false);
    expect(
      rejected.state.events.filter(
        (event) => event.type === "card_exposed" && event.card.id === holeCardId
      )
    ).toHaveLength(1);
  });

  it("rejects an incompatible replay version", () => {
    const state = createSession(DEFAULT_SESSION_CONFIG);
    const replay = exportReplay(state);

    expect(() => replaySession({ ...replay, schemaVersion: 99 })).toThrow(
      "Unsupported replay schema version: 99"
    );
  });

  it("enforces the maximum bet before mutating bankroll", () => {
    const state = createSession(DEFAULT_SESSION_CONFIG);
    const result = applyCommand(state, {
      type: "place_bet",
      amountCents: DEFAULT_SESSION_CONFIG.limits.maxBetCents + 500
    });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(selectTableView(state).bankrollCents).toBe(
      DEFAULT_SESSION_CONFIG.limits.startingBankrollCents
    );
  });

  it.each([
    [{ type: "place_bet", amountCents: 0 }, "positive whole-cent"],
    [{ type: "place_bet", amountCents: 501 }, "exact 3:2 payout"],
    [{ type: "deal" }, "Place a wager"],
    [{ type: "hit" }, "Hit is only available"]
  ] as const)(
    "rejects malformed or out-of-phase commands",
    (command, error) => {
      const state = createSession(DEFAULT_SESSION_CONFIG);
      const result = applyCommand(state, command);

      expect(result.ok).toBe(false);
      expect(result.error).toContain(error);
      expect(result.state).toBe(state);
    }
  );

  it("does not allow a wager to change during a player turn", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });

    const result = applyCommand(state, {
      type: "place_bet",
      amountCents: 1000
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("stops immediately after a round reaches the locked maximum loss", () => {
    let losingState: SessionState | undefined;
    for (let seed = 1; seed <= 100 && losingState === undefined; seed += 1) {
      const state = completeRound({
        ...DEFAULT_SESSION_CONFIG,
        seed,
        limits: {
          ...DEFAULT_SESSION_CONFIG.limits,
          maxBetCents: 500,
          maxLossCents: 500
        }
      });
      if (state.round?.result?.outcome === "loss") losingState = state;
    }

    expect(losingState).toBeDefined();
    expect(losingState?.phase).toBe("stopped");
    expect(losingState?.terminalReason).toBe("maximum_loss");
    const rejected = applyCommand(losingState!, {
      type: "place_bet",
      amountCents: 500
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(losingState);
  });

  it("finishes the cut-crossing round and starts a new shoe before the next deal", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 42,
      limits: {
        startingBankrollCents: 100_000,
        maxBetCents: 500,
        maxLossCents: 100_000
      }
    });
    let rounds = 0;

    while (state.shoe.number === 0) {
      state = accept(state, { type: "place_bet", amountCents: 500 });
      state = accept(state, { type: "deal" });
      if (state.phase === "insurance") {
        state = accept(state, { type: "decline_insurance" });
      }
      if (state.phase === "player") state = accept(state, { type: "stand" });
      rounds += 1;
      expect(rounds).toBeLessThan(100);
    }

    expect(state.shoe.number).toBe(1);
    expect(state.shufflePending).toBe(false);
    expect(
      state.events.filter((event) => event.type === "shoe_shuffled")
    ).toHaveLength(2);
    expect(state.cardsSeen).toBeGreaterThan(0);
    expect(state.cardsSeen).toBeLessThanOrEqual(4);
    const latestShuffleIndex = state.events
      .map((event) => event.type === "shoe_shuffled")
      .lastIndexOf(true);
    const currentShoeExposures = state.events
      .slice(latestShuffleIndex + 1)
      .filter((event) => event.type === "card_exposed");
    expect(state.cardsSeen).toBe(currentShoeExposures.length);
    expect(state.runningCount).toBe(
      currentShoeExposures.reduce(
        (count, event) => count + hiLoValue(event.card),
        0
      )
    );
  });

  it("rejects tampered replay algorithms, shoe data, and digest", () => {
    const state = completeRound({ ...DEFAULT_SESSION_CONFIG, seed: 17 });
    const replay = exportReplay(state);

    expect(() =>
      replaySession({
        ...replay,
        algorithms: { ...replay.algorithms, random: "other" as never }
      })
    ).toThrow("Unsupported random algorithm");
    expect(() =>
      replaySession({
        ...replay,
        resolvedShoeOrder: ["tampered", ...replay.resolvedShoeOrder.slice(1)]
      })
    ).toThrow("does not match");
    expect(() => replaySession({ ...replay, finalDigest: "tampered" })).toThrow(
      "digest does not match"
    );
  });

  it("doubles an eligible two-card hand, draws once, and settles twice the wager", () => {
    const seed = findSeed((ranks) => {
      const playerTotal = rankValue(ranks[0]!) + rankValue(ranks[2]!);
      return playerTotal === 10 || playerTotal === 11;
    });
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    const bankrollBefore = state.bankrollCents;
    state = accept(state, { type: "double" });

    expect(state.round?.playerHands[0]).toMatchObject({
      wagerCents: 2_000,
      doubled: true
    });
    expect(state.round?.playerHands[0]?.cards).toHaveLength(3);
    expect(state.bankrollCents - bankrollBefore).toBe(
      state.round?.result?.profitCents ?? 0
    );
  });

  it("splits a pair into independently settled hands", () => {
    const seed = findSeed((ranks) => ranks[0] === ranks[2]);
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "split" });

    expect(state.round?.playerHands).toHaveLength(2);
    expect(state.round?.playerHands.every((hand) => hand.fromSplit)).toBe(true);
    expect(
      state.round?.playerHands.every((hand) => hand.cards.length === 2)
    ).toBe(true);

    while (state.phase === "player") {
      state = accept(state, { type: "stand" });
    }
    expect(state.round?.result?.hands).toHaveLength(2);
    expect(state.round?.result?.wagerCents).toBe(1_000);
  });

  it("offers insurance against an ace and settles it at 2:1", () => {
    const seed = findSeed(
      (ranks) =>
        ranks[1] === "A" &&
        rankValue(ranks[3]!) === 10 &&
        !(ranks[0] === "A" && rankValue(ranks[2]!) === 10) &&
        !(ranks[2] === "A" && rankValue(ranks[0]!) === 10)
    );
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    expect(state.phase).toBe("insurance");
    state = accept(state, { type: "insurance" });

    expect(state.round?.insurance).toMatchObject({
      wagerCents: 500,
      profitCents: 1_000,
      outcome: "win"
    });
    expect(state.round?.result?.outcome).toBe("push");
    expect(state.round?.result).not.toBeNull();
  });

  it("supports declining insurance without charging the side bet", () => {
    const seed = findSeed((ranks) => ranks[1] === "A");
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "decline_insurance" });

    expect(state.round?.insurance).toMatchObject({
      wagerCents: 0,
      profitCents: 0,
      outcome: "declined"
    });
  });

  it.each(["early", "late"] as const)(
    "settles %s surrender at half the main wager",
    (surrender) => {
      const seed = findSeed(
        (ranks) => ranks[1] !== "A" && rankValue(ranks[1]!) !== 10
      );
      let state = createSession({
        ...DEFAULT_SESSION_CONFIG,
        seed,
        rules: { ...DEFAULT_SESSION_CONFIG.rules, surrender }
      });
      state = accept(state, { type: "place_bet", amountCents: 1_000 });
      state = accept(state, { type: "deal" });
      state = accept(state, { type: "surrender" });

      expect(state.round?.result).toMatchObject({
        outcome: "surrender",
        profitCents: -500
      });
    }
  );

  it("uses the configured 6:5 blackjack payout", () => {
    let completed: SessionState | undefined;
    for (let seed = 0; seed < 10_000 && completed === undefined; seed += 1) {
      const state = completeRound(
        {
          ...DEFAULT_SESSION_CONFIG,
          seed,
          rules: {
            ...DEFAULT_SESSION_CONFIG.rules,
            blackjackPayout: "6:5"
          }
        },
        1_000
      );
      if (state.round?.result?.outcome === "blackjack") completed = state;
    }
    expect(completed?.round?.result?.profitCents).toBe(1_200);
  });

  it("checks a dealer natural before the player turn when peek is enabled", () => {
    const seed = findSeed(
      (ranks) =>
        rankValue(ranks[1]!) === 10 &&
        ranks[3] === "A" &&
        !(ranks[0] === "A" && rankValue(ranks[2]!) === 10)
    );
    const base = { ...DEFAULT_SESSION_CONFIG, seed };
    let peek = createSession(base);
    peek = accept(peek, { type: "place_bet", amountCents: 500 });
    peek = accept(peek, { type: "deal" });
    expect(peek.phase).toBe("settled");
    expect(peek.round?.result?.outcome).toBe("loss");

    let noPeek = createSession({
      ...base,
      rules: { ...base.rules, dealerPeek: false }
    });
    noPeek = accept(noPeek, { type: "place_bet", amountCents: 500 });
    noPeek = accept(noPeek, { type: "deal" });
    expect(noPeek.phase).toBe("player");
  });

  it("never allows hard limits to be loosened after session creation", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = accept(state, {
      type: "tighten_limits",
      limits: { maxBetCents: 2_500, maxHands: 2, maxDurationSeconds: 60 }
    });
    expect(state.config.limits).toMatchObject({
      maxBetCents: 2_500,
      maxHands: 2,
      maxDurationSeconds: 60
    });

    const loosened = applyCommand(state, {
      type: "tighten_limits",
      limits: { maxBetCents: 5_000 }
    });
    expect(loosened.ok).toBe(false);
    expect(loosened.state).toBe(state);
  });

  it("stops at the deterministic duration and hand-count limits", () => {
    let timed = createSession({
      ...DEFAULT_SESSION_CONFIG,
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        maxDurationSeconds: 30
      }
    });
    timed = accept(timed, { type: "advance_time", seconds: 30 });
    expect(timed.phase).toBe("stopped");
    expect(timed.terminalReason).toBe("maximum_duration");

    const handLimited = completeRound({
      ...DEFAULT_SESSION_CONFIG,
      limits: { ...DEFAULT_SESSION_CONFIG.limits, maxHands: 1 }
    });
    expect(handLimited.phase).toBe("stopped");
    expect(handLimited.terminalReason).toBe("maximum_hands");
  });

  it("resolves early surrender before a dealer blackjack peek", () => {
    const seed = findSeed(
      (ranks) => ranks[1] === "A" && rankValue(ranks[3]!) === 10
    );
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      rules: { ...DEFAULT_SESSION_CONFIG.rules, surrender: "early" }
    });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    expect(state.phase).toBe("insurance");
    state = accept(state, { type: "surrender" });

    expect(state.round?.result).toMatchObject({
      outcome: "surrender",
      profitCents: -500
    });
  });

  it("does not let late surrender beat an unpeeked dealer blackjack", () => {
    const seed = findSeed(
      (ranks) => ranks[1] === "A" && rankValue(ranks[3]!) === 10
    );
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      rules: {
        ...DEFAULT_SESSION_CONFIG.rules,
        surrender: "late",
        dealerPeek: false
      }
    });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "decline_insurance" });
    state = accept(state, { type: "surrender" });

    expect(state.round?.result).toMatchObject({
      outcome: "loss",
      profitCents: -1_000
    });
  });

  it("never treats a split-ace 21 as a natural blackjack", () => {
    const seed = findSeed(
      (ranks) =>
        ranks[0] === "A" &&
        ranks[2] === "A" &&
        ranks[4] !== "A" &&
        ranks[5] !== "A" &&
        rankValue(ranks[4]!) !== 10
    );
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "split" });

    expect(state.round?.playerHands).toHaveLength(2);
    expect(
      state.round?.result?.hands.some(
        (result) => result.outcome === "blackjack"
      )
    ).toBe(false);
  });

  it("allows resplitting aces only when RSA is enabled", () => {
    const seed = findSeed(
      (ranks) => ranks[0] === "A" && ranks[2] === "A" && ranks[4] === "A"
    );
    let rsa = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    rsa = accept(rsa, { type: "place_bet", amountCents: 500 });
    rsa = accept(rsa, { type: "deal" });
    rsa = accept(rsa, { type: "split" });
    expect(selectTableView(rsa).canSplit).toBe(true);
    rsa = accept(rsa, { type: "split" });
    expect(rsa.round?.playerHands).toHaveLength(3);

    let noRsa = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      rules: { ...DEFAULT_SESSION_CONFIG.rules, resplitAces: false }
    });
    noRsa = accept(noRsa, { type: "place_bet", amountCents: 500 });
    noRsa = accept(noRsa, { type: "deal" });
    noRsa = accept(noRsa, { type: "split" });
    expect(selectTableView(noRsa).canSplit).toBe(false);
  });

  it("keeps a split-ace hand active when doubling split aces is allowed", () => {
    const seed = findSeed(
      (ranks) =>
        ranks[0] === "A" &&
        ranks[2] === "A" &&
        ranks[4] !== "A" &&
        ranks[5] !== "A" &&
        rankValue(ranks[4]!) !== 10
    );
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      rules: {
        ...DEFAULT_SESSION_CONFIG.rules,
        doubleSplitAces: true
      }
    });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "split" });
    expect(selectTableView(state).canDouble).toBe(true);
    expect(selectTableView(state).canHit).toBe(false);
  });

  it("allows doubling an opening wager at the locked maximum bet", () => {
    const seed = findSeed((ranks) => {
      const total = rankValue(ranks[0]!) + rankValue(ranks[2]!);
      return total === 10 || total === 11;
    });
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      limits: { ...DEFAULT_SESSION_CONFIG.limits, maxBetCents: 1_000 }
    });
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    state = accept(state, { type: "deal" });
    expect(selectTableView(state).canDouble).toBe(true);

    const doubled = applyCommand(state, { type: "double" });

    expect(doubled.ok).toBe(true);
    expect(doubled.state.round?.playerHands[0]?.wagerCents).toBe(2_000);
  });

  it("allows splitting distinct ten-value ranks", () => {
    const seed = findSeed(
      (ranks) =>
        rankValue(ranks[0]!) === 10 &&
        rankValue(ranks[2]!) === 10 &&
        ranks[0] !== ranks[2]
    );
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    expect(selectTableView(state).canSplit).toBe(true);
  });

  it("stops on a locked win target at the round boundary", () => {
    let completed: SessionState | undefined;
    for (let seed = 0; seed < 1_000 && completed === undefined; seed += 1) {
      const state = completeRound({
        ...DEFAULT_SESSION_CONFIG,
        seed,
        limits: { ...DEFAULT_SESSION_CONFIG.limits, winStopCents: 500 }
      });
      if ((state.round?.result?.profitCents ?? 0) >= 500) completed = state;
    }
    expect(completed?.phase).toBe("stopped");
    expect(completed?.terminalReason).toBe("win_stop");
  });

  it("burns exactly one card when each shoe opens", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      rules: { ...DEFAULT_SESSION_CONFIG.rules, burnCard: true }
    });
    expect(state.shoe.nextIndex).toBe(1);
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    expect(state.shoe.nextIndex).toBe(5);
    if (state.phase === "insurance") {
      state = accept(state, { type: "decline_insurance" });
    }
    if (state.phase === "player") state = accept(state, { type: "stand" });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    const beforeSecondDeal = state.shoe.nextIndex;
    state = accept(state, { type: "deal" });
    expect(state.shoe.nextIndex - beforeSecondDeal).toBe(4);
  });

  it("finishes a hand at 21 and rejects another hit", () => {
    const seed = findSeed((_, cards) => {
      const two = evaluateHand([cards[0]!, cards[2]!]);
      const three = evaluateHand([cards[0]!, cards[2]!, cards[4]!]);
      return !two.blackjack && two.total < 21 && three.total === 21;
    });
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    state = accept(state, { type: "hit" });
    expect(selectTableView(state).canHit).toBe(false);
    const rejected = applyCommand(state, { type: "hit" });
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(state);
  });

  it("defers a newly reached hard stop until an active round settles", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = accept(state, { type: "advance_time", seconds: 50 });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    state = accept(state, {
      type: "tighten_limits",
      limits: { maxDurationSeconds: 30 }
    });
    expect(state.phase).not.toBe("stopped");
    expect(state.stopAfterRoundReason).toBe("maximum_duration");
  });

  it("rejects tightening max bet below an already pending wager", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = accept(state, { type: "place_bet", amountCents: 1_000 });
    const result = applyCommand(state, {
      type: "tighten_limits",
      limits: { maxBetCents: 500 }
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("allows enabling a finite win stop when zero means disabled", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      limits: { ...DEFAULT_SESSION_CONFIG.limits, winStopCents: 0 }
    });
    state = accept(state, {
      type: "tighten_limits",
      limits: { winStopCents: 1_000 }
    });
    expect(state.config.limits.winStopCents).toBe(1_000);
  });

  it("detaches accepted nested command payloads from caller mutation", () => {
    const limits = { maxBetCents: 2_500 };
    const state = createSession(DEFAULT_SESSION_CONFIG);
    const result = applyCommand(state, { type: "tighten_limits", limits });
    expect(result.ok).toBe(true);
    limits.maxBetCents = 4_000;
    expect(result.state.successfulCommands[0]).toEqual({
      type: "tighten_limits",
      limits: { maxBetCents: 2_500 }
    });
  });

  it("reshuffles before an opening deal when fewer than four cards remain", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 91,
      rules: { ...DEFAULT_SESSION_CONFIG.rules, decks: 1 },
      penetration: { mode: "fixed", penetration: 0.99 }
    });
    let rounds = 0;
    while (rounds < 20 && state.phase !== "stopped") {
      state = accept(state, { type: "place_bet", amountCents: 500 });
      expect(() => applyCommand(state, { type: "deal" })).not.toThrow();
      state = accept(state, { type: "deal" });
      if (state.phase === "insurance") {
        state = accept(state, { type: "decline_insurance" });
      }
      if (state.phase === "player") state = accept(state, { type: "stand" });
      rounds += 1;
    }
    expect(rounds).toBeGreaterThan(1);
  });

  it("keeps early-surrender action selectors aligned during insurance", () => {
    const seed = findSeed((ranks) => ranks[1] === "A");
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      rules: { ...DEFAULT_SESSION_CONFIG.rules, surrender: "early" }
    });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    const view = selectTableView(state);
    expect(view.canSurrender).toBe(true);
    expect(view.canSplit).toBe(false);
  });

  it("does not advertise insurance without available bankroll", () => {
    const seed = findSeed((ranks) => ranks[1] === "A");
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed,
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        startingBankrollCents: 600,
        maxBetCents: 500,
        maxLossCents: 600
      }
    });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    expect(selectTableView(state).canInsure).toBe(false);
    expect(applyCommand(state, { type: "insurance" }).ok).toBe(false);
  });

  it("returns part of the discard pool after every continuous-shuffler round", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 785390425,
      shuffleMode: "continuous"
    });
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    if (state.phase === "insurance") {
      state = accept(state, { type: "decline_insurance" });
    }
    if (state.phase === "player") state = accept(state, { type: "stand" });

    expect(state.shufflePending).toBe(true);
    const cardsDealt = state.shoe.nextIndex;
    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    expect(state.shoe.number).toBe(1);
    expect(state.resolvedShoes).toHaveLength(2);
    expect(state.continuousDiscard.length).toBeGreaterThan(0);
    expect(state.continuousDiscard.length).toBeLessThan(cardsDealt);
    expect(state.shoe.cards.length + state.continuousDiscard.length).toBe(
      DEFAULT_SESSION_CONFIG.rules.decks * 52
    );
  });

  it.each([
    { type: "submit_count", value: Number.NaN },
    { type: "submit_count", value: 1.5 },
    { type: "submit_true_count", value: Number.POSITIVE_INFINITY },
    { type: "submit_deck_estimate", value: -1 }
  ] as const)("rejects invalid training values", (command) => {
    const state = createSession(DEFAULT_SESSION_CONFIG);
    const result = applyCommand(state, command);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("accepts each count answer once per newly exposed-card checkpoint", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    expect(applyCommand(state, { type: "submit_count", value: 0 }).ok).toBe(
      false
    );

    state = accept(state, { type: "place_bet", amountCents: 500 });
    state = accept(state, { type: "deal" });
    expect(selectTableView(state).trainingAvailable.runningCount).toBe(true);
    state = accept(state, {
      type: "submit_count",
      value: state.runningCount
    });
    expect(selectTableView(state).trainingAvailable.runningCount).toBe(false);
    expect(
      applyCommand(state, { type: "submit_count", value: state.runningCount })
        .ok
    ).toBe(false);

    if (state.phase === "insurance") {
      state = accept(state, { type: "decline_insurance" });
    }
    if (state.phase === "player") {
      state = accept(state, { type: "hit" });
      if (state.phase === "player") {
        expect(selectTableView(state).trainingAvailable.runningCount).toBe(
          true
        );
      }
    }
  });
});

function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

function findSeed(
  predicate: (
    firstSixRanks: readonly Rank[],
    firstSixCards: readonly Card[]
  ) => boolean
): number {
  for (let seed = 0; seed < 100_000; seed += 1) {
    const shoe = createShoe({
      decks: DEFAULT_SESSION_CONFIG.rules.decks,
      penetration: DEFAULT_SESSION_CONFIG.penetration,
      seed,
      shoeNumber: 0,
      shuffleMode: DEFAULT_SESSION_CONFIG.shuffleMode
    });
    const cards = shoe.cards.slice(0, 6);
    const ranks = cards.map((card) => card.rank);
    if (predicate(ranks, cards)) return seed;
  }
  throw new Error("No deterministic seed fixture was found.");
}
