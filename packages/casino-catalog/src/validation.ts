import type { CasinoGamePreset, PresetValidationResult } from "./types";

const DECK_COUNTS = new Set([1, 2, 4, 6, 8]);
const PAYOUTS = new Set(["3:2", "6:5"]);
const SOFT_17_RULES = new Set(["H17", "S17"]);
const DOUBLE_RULES = new Set(["any_two", "9_10_11", "10_11"]);
const SURRENDER_RULES = new Set(["none", "late", "early"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);
const SOURCE_TYPES = new Set(["official", "regulation", "published", "user"]);
const AVAILABILITY = new Set([
  "blackjack_officially_listed",
  "table_games_officially_listed",
  "historical_only"
]);

export function validateCustomPreset(input: unknown): PresetValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ["Preset must be an object."] };
  }

  validateString(input.id, "id", errors, {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
  });
  validateString(input.casino, "casino", errors);
  validateString(input.venue, "venue", errors);
  validateString(input.location, "location", errors);
  validateString(input.name, "name", errors);
  validateString(input.deviationSetId, "deviationSetId", errors, {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
  });
  validateEnum(input.confidence, "confidence", CONFIDENCE, errors);
  validateRules(input.rules, errors);
  validatePenetration(input.penetration, errors);
  validatePenetrationBasis(input.penetrationBasis, errors);
  validateHistoricalLimits(input.historicalLimits, errors);
  validateProvenance(input.provenance, errors);
  validateSources(input.sources, errors);
  validateNotes(input.notes, errors);

  return errors.length === 0
    ? { success: true, data: input as unknown as CasinoGamePreset }
    : { success: false, errors };
}

export function assertValidCustomPreset(input: unknown): CasinoGamePreset {
  const result = validateCustomPreset(input);
  if (!result.success) {
    throw new Error(`Invalid custom preset: ${result.errors.join(" ")}`);
  }
  return result.data;
}

function validateRules(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("rules must be an object.");
    return;
  }

  validateEnum(value.decks, "rules.decks", DECK_COUNTS, errors);
  validateEnum(value.blackjackPayout, "rules.blackjackPayout", PAYOUTS, errors);
  validateEnum(value.dealerSoft17, "rules.dealerSoft17", SOFT_17_RULES, errors);
  validateEnum(value.doubleRule, "rules.doubleRule", DOUBLE_RULES, errors);
  validateEnum(value.surrender, "rules.surrender", SURRENDER_RULES, errors);
  validateBooleanFields(
    value,
    [
      "doubleAfterSplit",
      "resplitAces",
      "hitSplitAces",
      "doubleSplitAces",
      "dealerPeek",
      "burnCard"
    ],
    "rules",
    errors
  );

  if (
    !Number.isInteger(value.maxSplitHands) ||
    !inRange(value.maxSplitHands, 2, 4)
  ) {
    errors.push("rules.maxSplitHands must be an integer from 2 through 4.");
  }
}

function validatePenetration(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("penetration must be an object.");
    return;
  }

  if (value.mode === "fixed") {
    validateFraction(value.penetration, "penetration.penetration", errors);
  } else if (value.mode === "range") {
    validateFraction(
      value.minPenetration,
      "penetration.minPenetration",
      errors
    );
    validateFraction(
      value.maxPenetration,
      "penetration.maxPenetration",
      errors
    );
    if (
      typeof value.minPenetration === "number" &&
      typeof value.maxPenetration === "number" &&
      value.minPenetration > value.maxPenetration
    ) {
      errors.push("penetration.minPenetration cannot exceed maxPenetration.");
    }
  } else if (value.mode === "observed_distribution") {
    validateFraction(
      value.fallbackPenetration,
      "penetration.fallbackPenetration",
      errors
    );
    if (!Array.isArray(value.observations) || value.observations.length === 0) {
      errors.push(
        "penetration.observations must contain at least one observation."
      );
    } else {
      value.observations.forEach((observation, index) => {
        if (!isRecord(observation)) {
          errors.push(`penetration.observations[${index}] must be an object.`);
          return;
        }
        validateFraction(
          observation.penetration,
          `penetration.observations[${index}].penetration`,
          errors
        );
        validateIsoDate(
          observation.observedAt,
          `penetration.observations[${index}].observedAt`,
          errors
        );
        validateEnum(
          observation.sourceType,
          `penetration.observations[${index}].sourceType`,
          new Set(["user", "community", "published"]),
          errors
        );
        validateEnum(
          observation.confidence,
          `penetration.observations[${index}].confidence`,
          CONFIDENCE,
          errors
        );
      });
    }
  } else {
    errors.push(
      "penetration.mode must be fixed, range, or observed_distribution."
    );
  }
}

function validatePenetrationBasis(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("penetrationBasis must be an object.");
    return;
  }
  validateEnum(
    value.kind,
    "penetrationBasis.kind",
    new Set(["training_default", "observed"]),
    errors
  );
  if (typeof value.adjustable !== "boolean") {
    errors.push("penetrationBasis.adjustable must be a boolean.");
  }
  validateEnum(
    value.confidence,
    "penetrationBasis.confidence",
    CONFIDENCE,
    errors
  );
  validateString(value.notes, "penetrationBasis.notes", errors);
}

function validateHistoricalLimits(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("historicalLimits must be an object.");
    return;
  }
  validateNullableCents(
    value.minimumCents,
    "historicalLimits.minimumCents",
    errors
  );
  validateNullableCents(
    value.maximumCents,
    "historicalLimits.maximumCents",
    errors
  );
  if (
    typeof value.minimumCents === "number" &&
    typeof value.maximumCents === "number" &&
    value.maximumCents < value.minimumCents
  ) {
    errors.push("historicalLimits.maximumCents cannot be below minimumCents.");
  }
  validateIsoDate(value.observedAt, "historicalLimits.observedAt", errors);
  validateEnum(
    value.confidence,
    "historicalLimits.confidence",
    CONFIDENCE,
    errors
  );
  validateString(value.notes, "historicalLimits.notes", errors);
}

function validateProvenance(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("provenance must be an object.");
    return;
  }
  validateIsoDate(value.rulesObservedAt, "provenance.rulesObservedAt", errors);
  validateEnum(
    value.rulesConfidence,
    "provenance.rulesConfidence",
    CONFIDENCE,
    errors
  );
  validateString(value.rulesNotes, "provenance.rulesNotes", errors);
  validateEnum(
    value.currentAvailability,
    "provenance.currentAvailability",
    AVAILABILITY,
    errors
  );
  validateIsoDate(
    value.currentAvailabilityAccessedAt,
    "provenance.currentAvailabilityAccessedAt",
    errors
  );
  validateCurrentPostedLimits(value.currentPostedLimits, errors);
  validateString(
    value.currentStatusCaveat,
    "provenance.currentStatusCaveat",
    errors
  );
}

function validateCurrentPostedLimits(value: unknown, errors: string[]): void {
  if (value === null) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("provenance.currentPostedLimits must be null or an object.");
    return;
  }
  validateNullableCents(
    value.minimumCents,
    "provenance.currentPostedLimits.minimumCents",
    errors
  );
  if (value.minimumCents === null) {
    errors.push("provenance.currentPostedLimits.minimumCents cannot be null.");
  }
  validateNullableCents(
    value.maximumCents,
    "provenance.currentPostedLimits.maximumCents",
    errors
  );
  validateString(
    value.schedule,
    "provenance.currentPostedLimits.schedule",
    errors
  );
  validateIsoDate(
    value.accessedAt,
    "provenance.currentPostedLimits.accessedAt",
    errors
  );
  validateEnum(
    value.confidence,
    "provenance.currentPostedLimits.confidence",
    CONFIDENCE,
    errors
  );
  validateString(value.caveat, "provenance.currentPostedLimits.caveat", errors);
}

function validateSources(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("sources must contain at least one source.");
    return;
  }

  value.forEach((source, index) => {
    if (!isRecord(source)) {
      errors.push(`sources[${index}] must be an object.`);
      return;
    }
    validateString(source.title, `sources[${index}].title`, errors);
    validateUrl(source.url, `sources[${index}].url`, errors);
    validateEnum(source.type, `sources[${index}].type`, SOURCE_TYPES, errors);
    validateEnum(
      source.confidence,
      `sources[${index}].confidence`,
      CONFIDENCE,
      errors
    );
    validateString(source.notes, `sources[${index}].notes`, errors);

    if (source.observedAt === undefined && source.accessedAt === undefined) {
      errors.push(`sources[${index}] must include observedAt or accessedAt.`);
    }
    if (source.observedAt !== undefined) {
      validateIsoDate(
        source.observedAt,
        `sources[${index}].observedAt`,
        errors
      );
    }
    if (source.accessedAt !== undefined) {
      validateIsoDate(
        source.accessedAt,
        `sources[${index}].accessedAt`,
        errors
      );
    }
  });
}

function validateNotes(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("notes must contain at least one note.");
    return;
  }
  value.forEach((note, index) =>
    validateString(note, `notes[${index}]`, errors)
  );
}

function validateBooleanFields(
  value: Record<PropertyKey, unknown>,
  fields: readonly string[],
  prefix: string,
  errors: string[]
): void {
  fields.forEach((field) => {
    if (typeof value[field] !== "boolean") {
      errors.push(`${prefix}.${field} must be a boolean.`);
    }
  });
}

function validateNullableCents(
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (
    value !== null &&
    (!Number.isInteger(value) || !inRange(value, 0, Number.MAX_SAFE_INTEGER))
  ) {
    errors.push(`${path} must be null or a non-negative integer.`);
  }
}

function validateFraction(
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {
    errors.push(`${path} must be greater than 0 and at most 1.`);
  }
}

function validateString(
  value: unknown,
  path: string,
  errors: string[],
  options: { readonly pattern?: RegExp } = {}
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 500
  ) {
    errors.push(
      `${path} must be a non-empty string no longer than 500 characters.`
    );
  } else if (options.pattern !== undefined && !options.pattern.test(value)) {
    errors.push(`${path} has an invalid format.`);
  }
}

function validateUrl(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length > 2048) {
    errors.push(`${path} must be an HTTP or HTTPS URL.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      errors.push(`${path} must be an HTTP or HTTPS URL.`);
    }
  } catch {
    errors.push(`${path} must be an HTTP or HTTPS URL.`);
  }
}

function validateIsoDate(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    errors.push(`${path} must be an ISO date in YYYY-MM-DD format.`);
    return;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    errors.push(`${path} must be an ISO date in YYYY-MM-DD format.`);
  }
}

function validateEnum(
  value: unknown,
  path: string,
  allowed: ReadonlySet<unknown>,
  errors: string[]
): void {
  if (!allowed.has(value)) {
    errors.push(`${path} has an unsupported value.`);
  }
}

function inRange(
  value: unknown,
  minimum: number,
  maximum: number
): value is number {
  return typeof value === "number" && value >= minimum && value <= maximum;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
