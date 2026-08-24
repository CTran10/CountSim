import {
  DEFAULT_SESSION_CONFIG,
  createSession,
  exportReplay
} from "@trueedge/game-core";
import { describe, expect, it } from "vitest";

import {
  APP_DATA_KEY,
  APP_DATA_VERSION,
  EMPTY_APP_DATA,
  MAX_STORED_BYTES,
  readAppData,
  recordSession,
  recordSkillAttempt,
  saveCustomGame,
  writeAppData,
  type StorageLike
} from "./storage";

function memoryStorage(initial: string | null = null): StorageLike & {
  value: string | null;
} {
  return {
    value: initial,
    getItem(key) {
      return key === APP_DATA_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === APP_DATA_KEY) this.value = value;
    }
  };
}

describe("local app data", () => {
  it("returns the clean baseline for malformed, oversized, or wrong-version data", () => {
    expect(readAppData(memoryStorage("{"))).toBe(EMPTY_APP_DATA);
    expect(readAppData(memoryStorage("x".repeat(MAX_STORED_BYTES + 1)))).toBe(
      EMPTY_APP_DATA
    );
    expect(
      readAppData(
        memoryStorage(
          JSON.stringify({
            version: 99,
            skills: [],
            sessions: [],
            customGames: []
          })
        )
      )
    ).toBe(EMPTY_APP_DATA);
  });

  it("records a validated summary and its skill deltas", () => {
    const next = recordSession(
      EMPTY_APP_DATA,
      {
        id: "session-1",
        completedAt: "2026-08-23T00:00:00.000Z",
        presetId: "lodge-dd",
        hands: 20,
        startingBankrollCents: 30_000,
        endingBankrollCents: 29_500,
        decisionQuality: 92,
        discipline: 100,
        intent: "deviation",
        intentScore: 90,
        skillResults: [{ id: "deviations", attempts: 20, correct: 18 }],
        completionReason: "hand_limit",
        replay: null,
        mistakes: [
          {
            handNumber: 4,
            situation: "16 vs 10 at TC +2",
            actual: "Hit",
            expected: "Stand",
            category: "deviations"
          }
        ]
      },
      [{ id: "deviations", attempts: 20, correct: 18 }]
    );

    expect(next.sessions).toHaveLength(1);
    expect(next.skills.find((skill) => skill.id === "deviations")).toEqual({
      id: "deviations",
      attempts: 20,
      correct: 18
    });
  });

  it("validates custom games and round-trips accepted data", () => {
    const next = saveCustomGame(EMPTY_APP_DATA, {
      id: "custom-local-dd",
      name: "Local DD Game",
      rules: { decks: 2, dealerSoft17: "H17", doubleAfterSplit: true },
      penetration: { mode: "fixed", value: 0.72 },
      shuffle: "perfect_random"
    });
    const storage = memoryStorage();

    expect(writeAppData(storage, next)).toBe(true);
    expect(readAppData(storage)).toEqual(next);
    expect(readAppData(storage).version).toBe(APP_DATA_VERSION);
  });

  it("stores a detailed drill attempt with its skill result", () => {
    const next = recordSkillAttempt(EMPTY_APP_DATA, "insurance", true, {
      id: "attempt-1",
      completedAt: "2026-08-23T00:00:00.000Z",
      skill: "insurance",
      prompt: "Insurance at TC +3",
      submitted: "insurance",
      expected: "insurance",
      correct: true,
      errorClass: "insurance",
      decisionTimeMs: 840,
      algorithmVersion: "basic-strategy-v1",
      profileVersion: "hi-lo-shoe-h17"
    });
    const storage = memoryStorage();

    expect(writeAppData(storage, next)).toBe(true);
    expect(readAppData(storage).drillAttempts).toEqual(next.drillAttempts);
    expect(next.skills.find((skill) => skill.id === "insurance")).toEqual({
      id: "insurance",
      attempts: 1,
      correct: 1
    });
  });

  it("keeps valid local progress while dropping an obsolete nested replay", () => {
    let data = recordSession(
      EMPTY_APP_DATA,
      {
        id: "session-with-old-replay",
        completedAt: "2026-08-23T00:00:00.000Z",
        presetId: "lodge-dd",
        hands: 1,
        startingBankrollCents: 30_000,
        endingBankrollCents: 30_000,
        decisionQuality: 100,
        discipline: 100,
        intent: "basic_strategy",
        intentScore: 100,
        skillResults: [{ id: "basic_strategy", attempts: 1, correct: 1 }],
        completionReason: "Hand limit reached",
        mistakes: [],
        replay: exportReplay(createSession(DEFAULT_SESSION_CONFIG))
      },
      [{ id: "basic_strategy", attempts: 1, correct: 1 }]
    );
    data = saveCustomGame(data, {
      id: "custom-local-dd",
      name: "Local DD Game",
      rules: { decks: 2, dealerSoft17: "H17", doubleAfterSplit: true },
      penetration: { mode: "fixed", value: 0.72 },
      shuffle: "perfect_random"
    });
    const serialized = JSON.parse(JSON.stringify(data)) as {
      sessions: { replay: { schemaVersion: number } | null }[];
    };
    serialized.sessions[0]!.replay!.schemaVersion = 2;

    const recovered = readAppData(memoryStorage(JSON.stringify(serialized)));

    expect(recovered.sessions).toHaveLength(1);
    expect(recovered.sessions[0]?.replay).toBeNull();
    expect(recovered.customGames).toHaveLength(1);
    expect(
      recovered.skills.find((skill) => skill.id === "basic_strategy")
    ).toMatchObject({ attempts: 1, correct: 1 });
  });

  it("does not throw when browser storage rejects a write", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      }
    };
    expect(writeAppData(storage, EMPTY_APP_DATA)).toBe(false);
  });

  it("falls back safely when browser storage rejects a read", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => undefined
    };
    expect(readAppData(storage)).toBe(EMPTY_APP_DATA);
  });
});
