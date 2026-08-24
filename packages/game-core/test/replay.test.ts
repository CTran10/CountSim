import { describe, expect, it } from "vitest";

import {
  DEFAULT_SESSION_CONFIG,
  REPLAY_SCHEMA_VERSION,
  applyCommand,
  createSession,
  exportReplay,
  parseSessionReplay,
  replayCommandPrefix,
  replaySession,
  replayTableTimeline,
  type SessionCommand,
  type SessionState
} from "../src/index";

function apply(state: SessionState, command: SessionCommand): SessionState {
  const result = applyCommand(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("replay schema v3", () => {
  it("records rule, penetration, shuffle, limit, and accepted-action inputs", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 312,
      penetration: {
        mode: "range",
        minPenetration: 0.7,
        maxPenetration: 0.76
      },
      shuffleMode: "automatic"
    });
    state = apply(state, {
      type: "tighten_limits",
      limits: { maxBetCents: 2_500 }
    });
    state = apply(state, { type: "place_bet", amountCents: 500 });
    state = apply(state, { type: "deal" });
    if (state.phase === "insurance") {
      state = apply(state, { type: "decline_insurance" });
    }
    if (state.phase === "player") state = apply(state, { type: "stand" });

    const replay = exportReplay(state);
    const reproduced = replaySession(replay);

    expect(replay.schemaVersion).toBe(REPLAY_SCHEMA_VERSION);
    expect(replay.schemaVersion).toBe(3);
    expect(replay.config.rules).toEqual(state.config.rules);
    expect(replay.config.penetration).toEqual(state.config.penetration);
    expect(replay.config.shuffleMode).toBe("automatic");
    expect(reproduced.digest).toBe(replay.finalDigest);
    expect(reproduced.state).toEqual(state);

    const jsonRoundTrip = JSON.parse(JSON.stringify(replay)) as typeof replay;
    expect(replaySession(jsonRoundTrip).digest).toBe(replay.finalDigest);
  });

  it("scrubs a validated replay without mutating the recorded command list", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = apply(state, { type: "place_bet", amountCents: 500 });
    state = apply(state, { type: "deal" });
    const replay = exportReplay(state);

    const opening = replayCommandPrefix(replay, 0);
    const wagered = replayCommandPrefix(replay, 1);
    expect(opening.state.phase).toBe("betting");
    expect(opening.state.pendingBetCents).toBe(0);
    expect(wagered.state.pendingBetCents).toBe(500);
    expect(replay.successfulCommands).toHaveLength(2);
    expect(() => replayCommandPrefix(replay, 3)).toThrow("outside");

    const timeline = replayTableTimeline(replay);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]).toMatchObject({ commandIndex: 0, command: null });
    expect(timeline[2]?.view.playerCards).toHaveLength(2);
  });

  it("validates persisted replay data before reproducing it", () => {
    let state = createSession(DEFAULT_SESSION_CONFIG);
    state = apply(state, { type: "place_bet", amountCents: 500 });
    const replay = {
      ...exportReplay(state),
      commandElapsedMs: [125]
    };

    expect(parseSessionReplay(JSON.parse(JSON.stringify(replay)))).toEqual(
      replay
    );
    expect(parseSessionReplay({ ...replay, commandElapsedMs: [] })).toBeNull();
    expect(
      parseSessionReplay({ ...replay, finalDigest: "tampered" })
    ).toBeNull();
    expect(
      parseSessionReplay({
        ...replay,
        successfulCommands: Array.from({ length: 5_001 }, () => ({
          type: "deal"
        }))
      })
    ).toBeNull();
  });

  it("keeps a default-length continuous-shuffler replay compact", () => {
    let state = createSession({
      ...DEFAULT_SESSION_CONFIG,
      seed: 903,
      shuffleMode: "continuous",
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        startingBankrollCents: 1_000_000,
        maxBetCents: 500,
        maxLossCents: 900_000,
        winStopCents: 900_000,
        handLimit: 100,
        maxHands: 100
      }
    });
    while (state.phase !== "stopped") {
      if (state.phase === "betting" || state.phase === "settled") {
        state = apply(state, { type: "place_bet", amountCents: 500 });
        state = apply(state, { type: "deal" });
      } else if (state.phase === "insurance") {
        state = apply(state, { type: "decline_insurance" });
      } else if (state.phase === "player") {
        state = apply(state, { type: "stand" });
      }
    }

    const replay = exportReplay(state);
    expect(state.analytics.handsPlayed).toBe(100);
    expect(replay.resolvedShoes).toHaveLength(100);
    expect(JSON.stringify(replay).length).toBeLessThan(300_000);
    expect(
      parseSessionReplay(JSON.parse(JSON.stringify(replay)))
    ).not.toBeNull();
  });
});
