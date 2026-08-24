import { describe, expect, it } from "vitest";

import {
  DEFAULT_SESSION_CONFIG,
  applyCommand,
  createSession,
  replaySession,
  exportReplay,
  selectTableView,
  type SessionCommand,
  type SessionConfig,
  type SessionState
} from "../src/index";

function accept(state: SessionState, command: SessionCommand): SessionState {
  const result = applyCommand(state, command);
  expect(result.ok, result.error).toBe(true);
  return result.state;
}

function dealt(seed: number, overrides: Partial<SessionConfig> = {}) {
  let state = createSession({
    ...DEFAULT_SESSION_CONFIG,
    ...overrides,
    seed,
    rules: { ...DEFAULT_SESSION_CONFIG.rules, ...overrides.rules },
    limits: { ...DEFAULT_SESSION_CONFIG.limits, ...overrides.limits }
  });
  state = accept(state, { type: "place_bet", amountCents: 500 });
  state = accept(state, { type: "deal" });
  return state;
}

function findActionSeed(predicate: (state: SessionState) => boolean) {
  for (let seed = 1; seed <= 4_000; seed += 1) {
    const state = dealt(seed);
    if (
      (state.phase === "player" || state.phase === "insurance") &&
      predicate(state)
    )
      return state;
  }
  throw new Error("No deterministic action fixture was found.");
}

describe("full blackjack actions", () => {
  it("doubles a two-card hand, draws one card, doubles the wager, and settles", () => {
    let state = findActionSeed(
      (candidate) => selectTableView(candidate).canDouble
    );
    const firstCards = selectTableView(state).playerCards.length;

    state = accept(state, { type: "double" });
    const view = selectTableView(state);

    expect(firstCards).toBe(2);
    expect(state.round?.playerHands[0]?.cards).toHaveLength(3);
    expect(state.round?.result?.wagerCents).toBe(1000);
    expect(view.canHit).toBe(false);
    expect(view.phase).toBe("settled");
  });

  it("splits equal ranks into independent hands and records both wagers", () => {
    let state = findActionSeed(
      (candidate) => selectTableView(candidate).canSplit
    );

    state = accept(state, { type: "split" });
    expect(state.round?.playerHands).toHaveLength(2);
    expect(state.round?.playerHands[0]?.wagerCents).toBe(500);
    expect(state.round?.playerHands[1]?.wagerCents).toBe(500);
    expect(
      state.events.some(
        (event) => event.type === "player_action" && event.action === "split"
      )
    ).toBe(true);
  });

  it("supports late surrender only when the ruleset offers it", () => {
    let state = dealt(7, {
      rules: { ...DEFAULT_SESSION_CONFIG.rules, surrender: "late" }
    });

    state = accept(state, { type: "surrender" });
    expect(state.phase).toBe("settled");
    expect(state.round?.result?.hands[0]).toMatchObject({
      outcome: "surrender",
      profitCents: -250
    });

    const noSurrender = dealt(7);
    const rejected = applyCommand(noSurrender, { type: "surrender" });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain("does not offer surrender");
  });

  it("offers insurance only against an ace and replays the accepted action", () => {
    let state = findActionSeed(
      (candidate) => candidate.round?.dealerCards[0]?.rank === "A"
    );
    state = accept(state, { type: "insurance", amountCents: 250 });
    state = accept(state, { type: "stand" });

    const replay = exportReplay(state);
    const reproduced = replaySession(replay);
    expect(reproduced.digest).toBe(replay.finalDigest);
    expect(replay.successfulCommands.map((command) => command.type)).toContain(
      "insurance"
    );
  });

  it("records running-count, deck-estimate, and true-count attempts", () => {
    let state = dealt(785390425);
    const view = selectTableView(state);
    state = accept(state, {
      type: "submit_count",
      value: view.count.runningCount
    });
    state = accept(state, {
      type: "submit_deck_estimate",
      value: view.count.decksRemainingEstimated
    });
    state = accept(state, {
      type: "submit_true_count",
      value: view.count.trueCountResolved
    });

    expect(state.analytics.countCorrect).toBe(1);
    expect(state.analytics.deckCorrect).toBe(1);
    expect(state.analytics.trueCountCorrect).toBe(1);
    expect(
      state.events.filter((event) => event.type === "training_attempt")
    ).toHaveLength(3);
  });
});
