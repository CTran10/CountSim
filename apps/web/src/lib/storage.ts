import { parseSessionReplay, type SessionReplay } from "@trueedge/game-core";

export const APP_DATA_VERSION = 1 as const;
export const APP_DATA_KEY = "trueedge:local-data:v1";
export const MAX_STORED_BYTES = 512_000;

export const SKILL_IDS = [
  "basic_strategy",
  "running_count",
  "deck_estimation",
  "true_count",
  "deviations",
  "insurance"
] as const;

export type StoredSkillId = (typeof SKILL_IDS)[number];

export interface StoredSkillProgress {
  readonly id: StoredSkillId;
  readonly attempts: number;
  readonly correct: number;
}

export interface StoredMistake {
  readonly handNumber: number;
  readonly situation: string;
  readonly actual: string;
  readonly expected: string;
  readonly category: StoredSkillId;
  readonly replayCommandIndex?: number;
}

export interface StoredSessionSummary {
  readonly id: string;
  readonly completedAt: string;
  readonly presetId: string;
  readonly hands: number;
  readonly startingBankrollCents: number;
  readonly endingBankrollCents: number;
  readonly decisionQuality: number;
  readonly discipline: number;
  readonly intent: string;
  readonly intentScore: number;
  readonly skillResults: readonly StoredSkillProgress[];
  readonly completionReason: string;
  readonly mistakes: readonly StoredMistake[];
  readonly replay: SessionReplay | null;
}

export interface StoredCustomGame {
  readonly id: string;
  readonly name: string;
  readonly rules: Readonly<Record<string, string | number | boolean>>;
  readonly penetration:
    | { readonly mode: "fixed"; readonly value: number }
    | {
        readonly mode: "range";
        readonly minimum: number;
        readonly maximum: number;
      }
    | {
        readonly mode: "observed_distribution";
        readonly values: readonly number[];
      };
  readonly shuffle:
    "perfect_random" | "automatic" | "simulated_hand" | "continuous";
}

export interface StoredDrillAttempt {
  readonly id: string;
  readonly completedAt: string;
  readonly skill: StoredSkillId;
  readonly prompt: string;
  readonly submitted: string;
  readonly expected: string;
  readonly correct: boolean;
  readonly errorClass: StoredSkillId;
  readonly decisionTimeMs: number;
  readonly algorithmVersion: string;
  readonly profileVersion: string;
}

export interface AppData {
  readonly version: typeof APP_DATA_VERSION;
  readonly skills: readonly StoredSkillProgress[];
  readonly sessions: readonly StoredSessionSummary[];
  readonly customGames: readonly StoredCustomGame[];
  readonly drillAttempts: readonly StoredDrillAttempt[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const EMPTY_APP_DATA: AppData = Object.freeze({
  version: APP_DATA_VERSION,
  skills: Object.freeze(
    SKILL_IDS.map((id) => Object.freeze({ id, attempts: 0, correct: 0 }))
  ),
  sessions: Object.freeze([]),
  customGames: Object.freeze([]),
  drillAttempts: Object.freeze([])
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum;
}

function isSkillId(value: unknown): value is StoredSkillId {
  return (
    typeof value === "string" &&
    (SKILL_IDS as readonly string[]).includes(value)
  );
}

function parseSkill(value: unknown): StoredSkillProgress | null {
  if (
    !isRecord(value) ||
    !isSkillId(value.id) ||
    !isSafeInteger(value.attempts) ||
    !isSafeInteger(value.correct) ||
    value.correct > value.attempts
  ) {
    return null;
  }
  return { id: value.id, attempts: value.attempts, correct: value.correct };
}

function parseMistake(value: unknown): StoredMistake | null {
  if (
    !isRecord(value) ||
    !isSafeInteger(value.handNumber, 1) ||
    typeof value.situation !== "string" ||
    typeof value.actual !== "string" ||
    typeof value.expected !== "string" ||
    !isSkillId(value.category) ||
    (value.replayCommandIndex !== undefined &&
      !isSafeInteger(value.replayCommandIndex)) ||
    value.situation.length > 120 ||
    value.actual.length > 80 ||
    value.expected.length > 80
  ) {
    return null;
  }
  return {
    handNumber: value.handNumber,
    situation: value.situation,
    actual: value.actual,
    expected: value.expected,
    category: value.category,
    ...(value.replayCommandIndex === undefined
      ? {}
      : { replayCommandIndex: value.replayCommandIndex })
  };
}

function parseSession(value: unknown): StoredSessionSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.completedAt !== "string" ||
    typeof value.presetId !== "string" ||
    !isSafeInteger(value.hands) ||
    !isSafeInteger(value.startingBankrollCents) ||
    !isSafeInteger(value.endingBankrollCents) ||
    !isSafeInteger(value.decisionQuality) ||
    value.decisionQuality > 100 ||
    !isSafeInteger(value.discipline) ||
    value.discipline > 100 ||
    (value.intent !== undefined && typeof value.intent !== "string") ||
    (value.intentScore !== undefined &&
      (!isSafeInteger(value.intentScore) || value.intentScore > 100)) ||
    (value.skillResults !== undefined &&
      (!Array.isArray(value.skillResults) ||
        value.skillResults.length > SKILL_IDS.length)) ||
    typeof value.completionReason !== "string" ||
    !Array.isArray(value.mistakes) ||
    value.mistakes.length > 250
  ) {
    return null;
  }
  const mistakes = value.mistakes.map(parseMistake);
  const skillResults = Array.isArray(value.skillResults)
    ? value.skillResults.map(parseSkill)
    : [];
  const replay =
    value.replay === undefined || value.replay === null
      ? null
      : parseSessionReplay(value.replay);
  if (
    mistakes.some((mistake) => mistake === null) ||
    skillResults.some((skill) => skill === null) ||
    (replay !== null &&
      mistakes.some(
        (mistake) =>
          mistake?.replayCommandIndex !== undefined &&
          mistake.replayCommandIndex > replay.successfulCommands.length
      ))
  ) {
    return null;
  }
  return {
    id: value.id.slice(0, 100),
    completedAt: value.completedAt.slice(0, 40),
    presetId: value.presetId.slice(0, 100),
    hands: value.hands,
    startingBankrollCents: value.startingBankrollCents,
    endingBankrollCents: value.endingBankrollCents,
    decisionQuality: value.decisionQuality,
    discipline: value.discipline,
    intent: String(value.intent ?? "full_game").slice(0, 40),
    intentScore:
      value.intentScore === undefined
        ? value.decisionQuality
        : Number(value.intentScore),
    skillResults: skillResults as StoredSkillProgress[],
    completionReason: value.completionReason.slice(0, 120),
    mistakes: mistakes as StoredMistake[],
    replay
  };
}

function parseCustomGame(value: unknown): StoredCustomGame | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    value.name.length < 1 ||
    value.name.length > 80 ||
    !isRecord(value.rules)
  ) {
    return null;
  }
  const entries = Object.entries(value.rules);
  if (
    entries.length > 24 ||
    entries.some(
      ([key, rule]) =>
        key.length > 50 ||
        !["string", "number", "boolean"].includes(typeof rule)
    )
  ) {
    return null;
  }
  const penetration = parseStoredPenetration(value.penetration);
  const shuffle = value.shuffle ?? "perfect_random";
  if (
    penetration === null ||
    !["perfect_random", "automatic", "simulated_hand", "continuous"].includes(
      String(shuffle)
    )
  ) {
    return null;
  }
  return {
    id: value.id.slice(0, 100),
    name: value.name,
    rules: Object.fromEntries(entries) as Record<
      string,
      string | number | boolean
    >,
    penetration,
    shuffle: shuffle as StoredCustomGame["shuffle"]
  };
}

function parseDrillAttempt(value: unknown): StoredDrillAttempt | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.completedAt !== "string" ||
    !isSkillId(value.skill) ||
    typeof value.prompt !== "string" ||
    typeof value.submitted !== "string" ||
    typeof value.expected !== "string" ||
    typeof value.correct !== "boolean" ||
    !isSkillId(value.errorClass) ||
    !isSafeInteger(value.decisionTimeMs) ||
    value.decisionTimeMs > 3_600_000 ||
    typeof value.algorithmVersion !== "string" ||
    typeof value.profileVersion !== "string"
  ) {
    return null;
  }
  return {
    id: value.id.slice(0, 100),
    completedAt: value.completedAt.slice(0, 40),
    skill: value.skill,
    prompt: value.prompt.slice(0, 240),
    submitted: value.submitted.slice(0, 80),
    expected: value.expected.slice(0, 80),
    correct: value.correct,
    errorClass: value.errorClass,
    decisionTimeMs: value.decisionTimeMs,
    algorithmVersion: value.algorithmVersion.slice(0, 80),
    profileVersion: value.profileVersion.slice(0, 80)
  };
}

function validPenetration(value: unknown): value is number {
  return typeof value === "number" && value > 0.4 && value < 0.95;
}

function parseStoredPenetration(
  value: unknown
): StoredCustomGame["penetration"] | null {
  if (validPenetration(value)) return { mode: "fixed", value };
  if (!isRecord(value)) return null;
  if (value.mode === "fixed" && validPenetration(value.value)) {
    return { mode: "fixed", value: value.value };
  }
  if (
    value.mode === "range" &&
    validPenetration(value.minimum) &&
    validPenetration(value.maximum) &&
    value.minimum <= value.maximum
  ) {
    return {
      mode: "range",
      minimum: value.minimum,
      maximum: value.maximum
    };
  }
  if (
    value.mode === "observed_distribution" &&
    Array.isArray(value.values) &&
    value.values.length >= 2 &&
    value.values.length <= 40 &&
    value.values.every(validPenetration)
  ) {
    return { mode: "observed_distribution", values: [...value.values] };
  }
  return null;
}

export function parseAppData(value: unknown): AppData | null {
  if (
    !isRecord(value) ||
    value.version !== APP_DATA_VERSION ||
    !Array.isArray(value.skills) ||
    value.skills.length > SKILL_IDS.length ||
    !Array.isArray(value.sessions) ||
    value.sessions.length > 100 ||
    !Array.isArray(value.customGames) ||
    value.customGames.length > 25 ||
    (value.drillAttempts !== undefined &&
      (!Array.isArray(value.drillAttempts) || value.drillAttempts.length > 250))
  ) {
    return null;
  }

  const skills = value.skills.map(parseSkill);
  const sessions = value.sessions.map(parseSession);
  const customGames = value.customGames.map(parseCustomGame);
  const drillAttempts = (value.drillAttempts ?? []).map(parseDrillAttempt);
  if (
    skills.some((skill) => skill === null) ||
    sessions.some((session) => session === null) ||
    customGames.some((game) => game === null) ||
    drillAttempts.some((attempt) => attempt === null)
  ) {
    return null;
  }

  const skillById = new Map(
    (skills as StoredSkillProgress[]).map((skill) => [skill.id, skill])
  );
  return {
    version: APP_DATA_VERSION,
    skills: SKILL_IDS.map(
      (id) => skillById.get(id) ?? { id, attempts: 0, correct: 0 }
    ),
    sessions: sessions as StoredSessionSummary[],
    customGames: customGames as StoredCustomGame[],
    drillAttempts: drillAttempts as StoredDrillAttempt[]
  };
}

export function readAppData(storage: StorageLike): AppData {
  try {
    const serialized = storage.getItem(APP_DATA_KEY);
    if (serialized === null || serialized.length > MAX_STORED_BYTES) {
      return EMPTY_APP_DATA;
    }
    return parseAppData(JSON.parse(serialized)) ?? EMPTY_APP_DATA;
  } catch {
    return EMPTY_APP_DATA;
  }
}

export function writeAppData(storage: StorageLike, data: AppData): boolean {
  const validated = parseAppData(data);
  if (validated === null) return false;
  const serialized = JSON.stringify(validated);
  if (serialized.length > MAX_STORED_BYTES) return false;
  try {
    storage.setItem(APP_DATA_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function readBrowserAppData(): AppData {
  if (typeof window === "undefined") return EMPTY_APP_DATA;
  try {
    return readAppData(window.localStorage);
  } catch {
    return EMPTY_APP_DATA;
  }
}

export function writeBrowserAppData(data: AppData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = writeAppData(window.localStorage, data);
    if (saved) window.dispatchEvent(new Event("trueedge:local-data-changed"));
    return saved;
  } catch {
    return false;
  }
}

export function recordSession(
  data: AppData,
  summary: StoredSessionSummary,
  skillDeltas: readonly {
    readonly id: StoredSkillId;
    readonly attempts: number;
    readonly correct: number;
  }[]
): AppData {
  const parsed = parseSession(summary);
  if (parsed === null) throw new Error("Session summary is invalid.");
  const deltas = new Map(skillDeltas.map((delta) => [delta.id, delta]));
  return {
    version: APP_DATA_VERSION,
    skills: data.skills.map((skill) => {
      const delta = deltas.get(skill.id);
      if (delta === undefined) return skill;
      if (
        !isSafeInteger(delta.attempts) ||
        !isSafeInteger(delta.correct) ||
        delta.correct > delta.attempts
      ) {
        throw new Error("Skill delta is invalid.");
      }
      return {
        ...skill,
        attempts: skill.attempts + delta.attempts,
        correct: skill.correct + delta.correct
      };
    }),
    sessions: [
      parsed,
      ...data.sessions
        .filter((item) => item.id !== parsed.id)
        .map((item) => ({ ...item, replay: null }))
    ].slice(0, 100),
    customGames: data.customGames,
    drillAttempts: data.drillAttempts
  };
}

export function recordSkillAttempt(
  data: AppData,
  id: StoredSkillId,
  correct: boolean,
  attempt?: StoredDrillAttempt
): AppData {
  const parsedAttempt =
    attempt === undefined ? undefined : parseDrillAttempt(attempt);
  if (parsedAttempt === null) {
    throw new Error("Drill attempt is invalid.");
  }
  return {
    ...data,
    skills: data.skills.map((skill) =>
      skill.id === id
        ? {
            ...skill,
            attempts: skill.attempts + 1,
            correct: skill.correct + (correct ? 1 : 0)
          }
        : skill
    ),
    drillAttempts:
      parsedAttempt === undefined
        ? data.drillAttempts
        : [parsedAttempt, ...data.drillAttempts].slice(0, 250)
  };
}

export function saveCustomGame(data: AppData, game: StoredCustomGame): AppData {
  const parsed = parseCustomGame(game);
  if (parsed === null) throw new Error("Custom game is invalid.");
  return {
    ...data,
    customGames: [
      parsed,
      ...data.customGames.filter((item) => item.id !== parsed.id)
    ].slice(0, 25)
  };
}
