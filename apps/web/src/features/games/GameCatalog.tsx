"use client";

import {
  BLACK_HAWK_PRESETS,
  type CasinoGamePreset
} from "@trueedge/casino-catalog";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCents } from "../../lib/format";
import type { StoredCustomGame } from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";
import { CustomGameForm } from "./CustomGameForm";
import styles from "./GameCatalog.module.css";

type DeckFilter = "all" | "2" | "6";

function booleanLabel(value: string | number | boolean | null): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null) return "Not verified";
  return String(value);
}

interface CompareProfile {
  readonly id: string;
  readonly label: string;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
}

function penetrationLabel(game: StoredCustomGame): string {
  if (game.penetration.mode === "fixed") {
    return `${Math.round(game.penetration.value * 100)}% local value`;
  }
  if (game.penetration.mode === "range") {
    return `${Math.round(game.penetration.minimum * 100)}-${Math.round(game.penetration.maximum * 100)}% local range`;
  }
  return `${game.penetration.values.map((value) => Math.round(value * 100)).join(", ")}% local observations`;
}

function catalogProfile(preset: CasinoGamePreset): CompareProfile {
  return {
    id: preset.id,
    label: `${preset.venue} ${preset.name}`,
    fields: {
      decks: preset.rules.decks,
      payout: preset.rules.blackjackPayout,
      soft17: preset.rules.dealerSoft17,
      double: preset.rules.doubleRule,
      das: preset.rules.doubleAfterSplit,
      rsa: preset.rules.resplitAces,
      surrender: preset.rules.surrender,
      splitHands: preset.rules.maxSplitHands,
      penetration:
        preset.penetration.mode === "fixed"
          ? `${Math.round(preset.penetration.penetration * 100)}% training default`
          : preset.penetration.mode,
      deviation: preset.deviationSetId,
      minimum:
        preset.historicalLimits.minimumCents === null
          ? null
          : formatCents(preset.historicalLimits.minimumCents),
      observed: preset.provenance.rulesObservedAt,
      confidence: preset.confidence
    }
  };
}

function customProfile(game: StoredCustomGame): CompareProfile {
  return {
    id: game.id,
    label: game.name,
    fields: {
      decks: game.rules.decks ?? null,
      payout: game.rules.blackjackPayout ?? null,
      soft17: game.rules.dealerSoft17 ?? null,
      double: game.rules.doubleRule ?? null,
      das: game.rules.doubleAfterSplit ?? null,
      rsa: game.rules.resplitAces ?? null,
      surrender: game.rules.surrender ?? null,
      splitHands: game.rules.maxSplitHands ?? null,
      penetration: penetrationLabel(game),
      deviation:
        game.rules.deviationProfile ??
        (Number(game.rules.decks) <= 2 ? "hi-lo-dd-h17" : "hi-lo-shoe-h17"),
      minimum: null,
      observed: "Local profile",
      confidence: "user"
    }
  };
}

const COMPARE_ROWS = [
  ["decks", "Decks"],
  ["payout", "Blackjack"],
  ["soft17", "Dealer soft 17"],
  ["double", "Double"],
  ["das", "Double after split"],
  ["rsa", "Resplit aces"],
  ["surrender", "Surrender"],
  ["splitHands", "Maximum split hands"],
  ["penetration", "Penetration"],
  ["deviation", "Deviation profile"],
  ["minimum", "Historical minimum"],
  ["observed", "Observation date"],
  ["confidence", "Confidence"]
] as const;

function RuleLine({ preset }: { readonly preset: CasinoGamePreset }) {
  return (
    <p className={styles.ruleLine}>
      {preset.rules.decks}D <span>·</span> {preset.rules.blackjackPayout}{" "}
      <span>·</span> {preset.rules.dealerSoft17} <span>·</span>{" "}
      {preset.rules.doubleAfterSplit ? "DAS" : "No DAS"}
    </p>
  );
}

function PresetRow({
  preset,
  selected,
  onToggle
}: {
  readonly preset: CasinoGamePreset;
  readonly selected: boolean;
  readonly onToggle: () => void;
}) {
  const penetration =
    preset.penetration.mode === "fixed"
      ? `${Math.round(preset.penetration.penetration * 100)}%`
      : preset.penetration.mode;
  const minimum = preset.historicalLimits.minimumCents;

  return (
    <article className={styles.preset}>
      <label className={styles.compareChoice}>
        <input checked={selected} onChange={onToggle} type="checkbox" />
        <span>Compare</span>
      </label>
      <div className={styles.gameIdentity}>
        <span>{preset.venue}</span>
        <h2>{preset.name}</h2>
        <RuleLine preset={preset} />
      </div>
      <dl className={styles.gameMetrics}>
        <div>
          <dt>Penetration</dt>
          <dd>{penetration}</dd>
          <small>Adjustable training default</small>
        </div>
        <div>
          <dt>Index profile</dt>
          <dd>{preset.deviationSetId.replaceAll("-", " ")}</dd>
          <small>Hi-Lo</small>
        </div>
        <div>
          <dt>Historical min</dt>
          <dd>{minimum === null ? "Not verified" : formatCents(minimum)}</dd>
          <small>{preset.historicalLimits.observedAt.slice(0, 7)}</small>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd className={styles.confidence}>{preset.confidence}</dd>
          <small>Conditions may have changed</small>
        </div>
      </dl>
      <div className={styles.rowActions}>
        <Link href={`/setup?preset=${encodeURIComponent(preset.id)}`}>
          Practice
        </Link>
        <details>
          <summary>Evidence</summary>
          <div className={styles.evidence}>
            <p>{preset.provenance.currentStatusCaveat}</p>
            <ul>
              {preset.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noreferrer" target="_blank">
                    {source.title}
                  </a>
                  <span>
                    {source.type} · {source.confidence} confidence
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}

export function GameCatalog() {
  const [filter, setFilter] = useState<DeckFilter>("all");
  const [selected, setSelected] = useState<readonly string[]>([
    "ballys-north-dd",
    "lodge-dd"
  ]);
  const customGames = useAppData().customGames;

  const presets = useMemo(
    () =>
      BLACK_HAWK_PRESETS.filter(
        (preset) => filter === "all" || String(preset.rules.decks) === filter
      ),
    [filter]
  );
  const allProfiles = [
    ...BLACK_HAWK_PRESETS.map(catalogProfile),
    ...customGames.map(customProfile)
  ];
  const comparison =
    selected.length === 2
      ? selected
          .map((id) => allProfiles.find((profile) => profile.id === id))
          .filter((profile): profile is CompareProfile => profile !== undefined)
      : [];

  function toggleCompare(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current.slice(-1), id];
    });
  }

  return (
    <div className={styles.catalog}>
      <section className={styles.notice} aria-label="Catalog data notice">
        <strong>Historical training presets</strong>
        <p>
          Official pages confirm venue or game availability. Exact rules and
          limits are dated observations; penetration is adjustable training data
          unless explicitly marked observed. Verify the table placard and house
          rules before relying on any preset.
        </p>
      </section>

      <div className={styles.toolbar}>
        <div aria-label="Filter by deck count" role="group">
          {(["all", "2", "6"] as const).map((value) => (
            <button
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {value === "all" ? "All games" : `${value} deck`}
            </button>
          ))}
        </div>
        <span>{presets.length} profiles · Black Hawk, Colorado</span>
      </div>

      <section
        className={styles.presetList}
        aria-label="Black Hawk game presets"
      >
        {presets.map((preset) => (
          <PresetRow
            key={preset.id}
            onToggle={() => toggleCompare(preset.id)}
            preset={preset}
            selected={selected.includes(preset.id)}
          />
        ))}
      </section>

      {customGames.length === 0 ? null : (
        <section className={styles.localCompare} aria-label="Saved local games">
          <strong>Saved local games</strong>
          {customGames.map((game) => (
            <label key={game.id}>
              <input
                checked={selected.includes(game.id)}
                onChange={() => toggleCompare(game.id)}
                type="checkbox"
              />
              <span>{game.name}</span>
              <small>
                {String(game.rules.decks)}D · {String(game.rules.dealerSoft17)}
              </small>
            </label>
          ))}
        </section>
      )}

      <section className={styles.comparison} aria-labelledby="compare-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span>Aligned rules</span>
            <h2 id="compare-heading">Compare selected games</h2>
          </div>
          <p>Select any two rows above.</p>
        </div>
        {comparison.length !== 2 ? (
          <p className={styles.compareEmpty}>Choose two games to compare.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  {comparison.map((profile) => (
                    <th key={profile.id} scope="col">
                      {profile.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([field, label]) => {
                  const values = comparison.map(
                    (profile) => profile.fields[field] ?? null
                  );
                  const differs = values[0] !== values[1];
                  return (
                    <tr
                      className={differs ? styles.differs : undefined}
                      key={field}
                    >
                      <th scope="row">{label}</th>
                      {values.map((value, index) => (
                        <td key={`${field}-${comparison[index]?.id ?? index}`}>
                          {booleanLabel(value)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CustomGameForm />
    </div>
  );
}
