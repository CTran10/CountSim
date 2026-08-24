import { deterministicDigest } from "./digest";
import { DIGEST_ALGORITHM } from "./digest";
import { RNG_ALGORITHM, SHUFFLE_ALGORITHM } from "./rng";
import {
  applyCommand,
  createSession,
  selectTableView,
  type SessionCommand,
  type SessionConfig,
  type SessionState,
  type TableView
} from "./session";

export const REPLAY_SCHEMA_VERSION = 3 as const;

export interface ReplayResolvedShoe {
  readonly number: number;
  readonly cutIndex: number;
  readonly penetration: number;
  readonly shuffleMode: SessionState["shoe"]["shuffleMode"];
  readonly orderDigest: string;
}

export interface SessionReplay {
  readonly schemaVersion: number;
  readonly algorithms: {
    readonly random: typeof RNG_ALGORITHM;
    readonly shuffle: typeof SHUFFLE_ALGORITHM;
    readonly digest: typeof DIGEST_ALGORITHM;
  };
  readonly config: SessionConfig;
  readonly resolvedShoeOrder: readonly string[];
  readonly resolvedCutIndex: number;
  readonly resolvedShoes: readonly ReplayResolvedShoe[];
  readonly successfulCommands: readonly SessionCommand[];
  readonly commandElapsedMs?: readonly number[];
  readonly finalDigest: string;
}

export interface ReplayTableFrame {
  readonly commandIndex: number;
  readonly command: SessionCommand | null;
  readonly view: TableView;
}

export const MAX_REPLAY_COMMANDS = 5_000 as const;
export const MAX_REPLAY_SHOES = 100 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stateDigest(state: SessionState): string {
  return deterministicDigest(state);
}

function copyCommand(command: SessionCommand): SessionCommand {
  if (command.type === "tighten_limits") {
    return Object.freeze({
      type: command.type,
      limits: Object.freeze({ ...command.limits })
    });
  }
  return Object.freeze({ ...command });
}

export function exportReplay(state: SessionState): SessionReplay {
  const initial = state.resolvedShoes[0];
  if (initial === undefined)
    throw new Error("Replay is missing its initial shoe.");
  const resolvedShoes = Object.freeze(
    state.resolvedShoes.map((shoe) =>
      Object.freeze({
        number: shoe.number,
        cutIndex: shoe.cutIndex,
        penetration: shoe.penetration,
        shuffleMode: shoe.shuffleMode,
        orderDigest: deterministicDigest(shoe.order)
      })
    )
  );
  return Object.freeze({
    schemaVersion: REPLAY_SCHEMA_VERSION,
    algorithms: {
      random: RNG_ALGORITHM,
      shuffle: SHUFFLE_ALGORITHM,
      digest: DIGEST_ALGORITHM
    },
    config: state.config,
    resolvedShoeOrder: Object.freeze([...initial.order]),
    resolvedCutIndex: initial.cutIndex,
    resolvedShoes,
    successfulCommands: Object.freeze(
      state.successfulCommands.map(copyCommand)
    ),
    finalDigest: stateDigest(state)
  });
}

function assertReplayAlgorithms(replay: SessionReplay): void {
  if (replay.algorithms.random !== RNG_ALGORITHM) {
    throw new Error(
      `Unsupported random algorithm: ${replay.algorithms.random}`
    );
  }
  if (replay.algorithms.shuffle !== SHUFFLE_ALGORITHM) {
    throw new Error(
      `Unsupported shuffle algorithm: ${replay.algorithms.shuffle}`
    );
  }
  if (replay.algorithms.digest !== DIGEST_ALGORITHM) {
    throw new Error(
      `Unsupported digest algorithm: ${replay.algorithms.digest}`
    );
  }
}

function createVerifiedReplaySession(replay: SessionReplay): SessionState {
  if (replay.schemaVersion !== REPLAY_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported replay schema version: ${replay.schemaVersion}`
    );
  }
  assertReplayAlgorithms(replay);
  const state = createSession(replay.config);
  const initial = state.resolvedShoes[0];
  if (
    initial === undefined ||
    initial.cutIndex !== replay.resolvedCutIndex ||
    initial.order.length !== replay.resolvedShoeOrder.length ||
    initial.order.some(
      (cardId, index) => cardId !== replay.resolvedShoeOrder[index]
    )
  ) {
    throw new Error(
      "Replay shoe data does not match its deterministic configuration."
    );
  }
  return state;
}

export function replayCommandPrefix(
  replay: SessionReplay,
  commandCount: number
): { readonly state: SessionState; readonly digest: string } {
  if (
    !Number.isInteger(commandCount) ||
    commandCount < 0 ||
    commandCount > replay.successfulCommands.length
  ) {
    throw new Error("Replay command position is outside the recorded range.");
  }
  let state = createVerifiedReplaySession(replay);
  for (const command of replay.successfulCommands.slice(0, commandCount)) {
    const result = applyCommand(state, command);
    if (!result.ok) {
      throw new Error(
        `Replay contains an invalid ${command.type} command: ${result.error}`
      );
    }
    state = result.state;
  }
  return { state, digest: stateDigest(state) };
}

function assertFinalReplayState(
  replay: SessionReplay,
  state: SessionState
): string {
  if (
    state.resolvedShoes.length !== replay.resolvedShoes.length ||
    state.resolvedShoes.some((shoe, index) => {
      const expected = replay.resolvedShoes[index];
      return (
        expected === undefined ||
        shoe.number !== expected.number ||
        shoe.cutIndex !== expected.cutIndex ||
        shoe.penetration !== expected.penetration ||
        shoe.shuffleMode !== expected.shuffleMode ||
        deterministicDigest(shoe.order) !== expected.orderDigest
      );
    })
  ) {
    throw new Error("Replay contains inconsistent resolved shoe history.");
  }

  const digest = stateDigest(state);
  if (digest !== replay.finalDigest) {
    throw new Error("Replay digest does not match the reproduced session.");
  }
  return digest;
}

/** Reproduces once and retains lightweight table views for scrubbing. */
export function replayTableTimeline(
  replay: SessionReplay
): readonly ReplayTableFrame[] {
  let state = createVerifiedReplaySession(replay);
  const frames: ReplayTableFrame[] = [
    Object.freeze({
      commandIndex: 0,
      command: null,
      view: selectTableView(state)
    })
  ];
  for (const [index, command] of replay.successfulCommands.entries()) {
    const result = applyCommand(state, command);
    if (!result.ok) {
      throw new Error(
        `Replay contains an invalid ${command.type} command: ${result.error}`
      );
    }
    state = result.state;
    frames.push(
      Object.freeze({
        commandIndex: index + 1,
        command,
        view: selectTableView(state)
      })
    );
  }
  assertFinalReplayState(replay, state);
  return Object.freeze(frames);
}

export function replaySession(replay: SessionReplay): {
  readonly state: SessionState;
  readonly digest: string;
} {
  const prefix = replayCommandPrefix(replay, replay.successfulCommands.length);
  const state = prefix.state;
  const digest = assertFinalReplayState(replay, state);
  return { state, digest };
}

/**
 * Validates an unknown replay at the persistence/import boundary, including a
 * full deterministic reproduction. Array limits are checked before replaying
 * so malformed browser data cannot trigger unbounded work.
 */
export function parseSessionReplay(value: unknown): SessionReplay | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== REPLAY_SCHEMA_VERSION ||
    !isRecord(value.algorithms) ||
    !isRecord(value.config) ||
    !Array.isArray(value.resolvedShoeOrder) ||
    value.resolvedShoeOrder.length > 416 ||
    !Number.isSafeInteger(value.resolvedCutIndex) ||
    !Array.isArray(value.resolvedShoes) ||
    value.resolvedShoes.length < 1 ||
    value.resolvedShoes.length > MAX_REPLAY_SHOES ||
    !Array.isArray(value.successfulCommands) ||
    value.successfulCommands.length > MAX_REPLAY_COMMANDS ||
    typeof value.finalDigest !== "string" ||
    value.finalDigest.length > 100 ||
    (value.commandElapsedMs !== undefined &&
      (!Array.isArray(value.commandElapsedMs) ||
        value.commandElapsedMs.length !== value.successfulCommands.length))
  ) {
    return null;
  }

  if (
    value.resolvedShoeOrder.some((cardId) => typeof cardId !== "string") ||
    value.resolvedShoes.some(
      (shoe) =>
        !isRecord(shoe) ||
        !Number.isSafeInteger(shoe.number) ||
        Number(shoe.number) < 0 ||
        !Number.isSafeInteger(shoe.cutIndex) ||
        Number(shoe.cutIndex) < 1 ||
        typeof shoe.penetration !== "number" ||
        !Number.isFinite(shoe.penetration) ||
        shoe.penetration <= 0 ||
        shoe.penetration >= 1 ||
        !["perfect", "automatic", "simulated_hand", "continuous"].includes(
          String(shoe.shuffleMode)
        ) ||
        typeof shoe.orderDigest !== "string" ||
        shoe.orderDigest.length > 100
    ) ||
    value.successfulCommands.some(
      (command) => !isRecord(command) || typeof command.type !== "string"
    ) ||
    (Array.isArray(value.commandElapsedMs) &&
      value.commandElapsedMs.some(
        (elapsed, index, all) =>
          !Number.isSafeInteger(elapsed) ||
          Number(elapsed) < 0 ||
          Number(elapsed) > 86_400_000 ||
          (index > 0 && Number(elapsed) < Number(all[index - 1]))
      ))
  ) {
    return null;
  }

  try {
    const replay = value as unknown as SessionReplay;
    replaySession(replay);
    return replay;
  } catch {
    return null;
  }
}
