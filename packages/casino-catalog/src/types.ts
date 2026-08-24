import type { GameRules, PenetrationConfig } from "../../game-core/src/types";

export type CatalogConfidence = "low" | "medium" | "high";
export type CatalogSourceType =
  "official" | "regulation" | "published" | "user";

interface CatalogSourceBase {
  readonly title: string;
  readonly url: string;
  readonly type: CatalogSourceType;
  readonly confidence: CatalogConfidence;
  readonly notes: string;
}

export type CatalogSource = CatalogSourceBase &
  (
    | {
        readonly observedAt: string;
        readonly accessedAt?: string;
      }
    | {
        readonly observedAt?: never;
        readonly accessedAt: string;
      }
  );

export type CurrentAvailability =
  | "blackjack_officially_listed"
  | "table_games_officially_listed"
  | "historical_only";

export interface HistoricalLimits {
  readonly minimumCents: number | null;
  readonly maximumCents: number | null;
  readonly observedAt: string;
  readonly confidence: CatalogConfidence;
  readonly notes: string;
}

export interface PresetProvenance {
  readonly rulesObservedAt: string;
  readonly rulesConfidence: CatalogConfidence;
  readonly rulesNotes: string;
  readonly currentAvailability: CurrentAvailability;
  readonly currentAvailabilityAccessedAt: string;
  readonly currentPostedLimits: CurrentPostedLimits | null;
  readonly currentStatusCaveat: string;
}

export interface CurrentPostedLimits {
  readonly minimumCents: number;
  readonly maximumCents: number | null;
  readonly schedule: string;
  readonly accessedAt: string;
  readonly confidence: CatalogConfidence;
  readonly caveat: string;
}

export interface PenetrationBasis {
  readonly kind: "training_default" | "observed";
  readonly adjustable: boolean;
  readonly confidence: CatalogConfidence;
  readonly notes: string;
}

export interface CasinoGamePreset {
  readonly id: string;
  readonly casino: string;
  readonly venue: string;
  readonly location: string;
  readonly name: string;
  readonly rules: GameRules;
  readonly penetration: PenetrationConfig;
  readonly penetrationBasis: PenetrationBasis;
  readonly deviationSetId: string;
  readonly historicalLimits: HistoricalLimits;
  readonly provenance: PresetProvenance;
  readonly sources: readonly CatalogSource[];
  readonly confidence: CatalogConfidence;
  readonly notes: readonly string[];
}

export interface ListPresetOptions {
  readonly casino?: string;
  readonly decks?: GameRules["decks"];
}

export type ComparisonField =
  | "decks"
  | "blackjackPayout"
  | "dealerSoft17"
  | "doubleRule"
  | "doubleAfterSplit"
  | "resplitAces"
  | "surrender"
  | "historicalMinimumCents"
  | "penetration";

export interface PresetComparisonRow {
  readonly field: ComparisonField;
  readonly label: string;
  readonly values: readonly (string | number | boolean | null)[];
  readonly differs: boolean;
}

export interface PresetComparison {
  readonly presets: readonly CasinoGamePreset[];
  readonly rows: readonly PresetComparisonRow[];
}

export type PresetValidationResult =
  | { readonly success: true; readonly data: CasinoGamePreset }
  | { readonly success: false; readonly errors: readonly string[] };
