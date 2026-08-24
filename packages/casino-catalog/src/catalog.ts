import type {
  CasinoGamePreset,
  ListPresetOptions,
  PresetComparison
} from "./types";
import { BLACK_HAWK_PRESETS } from "./data";

const byId = new Map(BLACK_HAWK_PRESETS.map((preset) => [preset.id, preset]));

export function listPresets(
  options: ListPresetOptions = {}
): readonly CasinoGamePreset[] {
  const casino = options.casino?.trim().toLocaleLowerCase();

  return BLACK_HAWK_PRESETS.filter(
    (preset) =>
      (casino === undefined || preset.casino.toLocaleLowerCase() === casino) &&
      (options.decks === undefined || preset.rules.decks === options.decks)
  );
}

export function getPreset(id: string): CasinoGamePreset | undefined {
  return byId.get(id);
}

export function searchPresets(query: string): readonly CasinoGamePreset[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);

  if (terms.length === 0) {
    return BLACK_HAWK_PRESETS;
  }

  return BLACK_HAWK_PRESETS.filter((preset) => {
    const searchable = [
      preset.id,
      preset.casino,
      preset.venue,
      preset.location,
      preset.name,
      `${preset.rules.decks}d`,
      preset.rules.decks === 2 ? "dd" : "",
      `${preset.rules.decks} deck`,
      preset.rules.blackjackPayout,
      preset.rules.dealerSoft17,
      preset.deviationSetId
    ]
      .join(" ")
      .toLocaleLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

export function comparePresets(ids: readonly string[]): PresetComparison {
  if (ids.length < 2) {
    throw new Error("Compare at least two presets.");
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error("Preset comparison cannot contain duplicate ids.");
  }

  const presets = ids.map((id) => {
    const preset = getPreset(id);
    if (preset === undefined) {
      throw new Error(`Unknown preset: ${id}`);
    }
    return preset;
  });

  const rows = [
    row(
      "decks",
      "Decks",
      presets.map((preset) => preset.rules.decks)
    ),
    row(
      "blackjackPayout",
      "Blackjack",
      presets.map((preset) => preset.rules.blackjackPayout)
    ),
    row(
      "dealerSoft17",
      "Dealer soft 17",
      presets.map((preset) => preset.rules.dealerSoft17)
    ),
    row(
      "doubleRule",
      "Double",
      presets.map((preset) => preset.rules.doubleRule)
    ),
    row(
      "doubleAfterSplit",
      "Double after split",
      presets.map((preset) => preset.rules.doubleAfterSplit)
    ),
    row(
      "resplitAces",
      "Resplit aces",
      presets.map((preset) => preset.rules.resplitAces)
    ),
    row(
      "surrender",
      "Surrender",
      presets.map((preset) => preset.rules.surrender)
    ),
    row(
      "historicalMinimumCents",
      "Historical minimum",
      presets.map((preset) => preset.historicalLimits.minimumCents)
    ),
    row(
      "penetration",
      "Training penetration",
      presets.map((preset) =>
        preset.penetration.mode === "fixed"
          ? preset.penetration.penetration
          : preset.penetration.mode
      )
    )
  ] as const;

  return { presets, rows };
}

function row(
  field: PresetComparison["rows"][number]["field"],
  label: string,
  values: readonly (string | number | boolean | null)[]
): PresetComparison["rows"][number] {
  return {
    field,
    label,
    values,
    differs: values.some((value) => value !== values[0])
  };
}
