"use client";

import {
  BLACK_HAWK_PRESETS,
  type CasinoGamePreset
} from "@trueedge/casino-catalog";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  DEFAULT_SELECTED_GAME_ID,
  migrateSelectedGameId,
  replaceSelectedGameId
} from "../../lib/gamePreference";
import type { StoredCustomGame } from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";
import { CustomGameForm } from "./CustomGameForm";
import styles from "./GameCatalog.module.css";

const PRESET_OVERRIDE_PREFIX = "custom-catalog-";
const PRESET_OVERRIDE_IDS = new Set(
  BLACK_HAWK_PRESETS.map((preset) => `${PRESET_OVERRIDE_PREFIX}${preset.id}`)
);

function presetOverrideId(presetId: string): string {
  return `${PRESET_OVERRIDE_PREFIX}${presetId}`;
}

function presetLabel(preset: CasinoGamePreset): string {
  return `${preset.venue} ${preset.name}`;
}

function presetAsCustomGame(preset: CasinoGamePreset): StoredCustomGame {
  const penetration: StoredCustomGame["penetration"] =
    preset.penetration.mode === "range"
      ? {
          mode: "range",
          minimum: preset.penetration.minPenetration,
          maximum: preset.penetration.maxPenetration
        }
      : preset.penetration.mode === "observed_distribution" &&
          preset.penetration.observations.length >= 2
        ? {
            mode: "observed_distribution",
            values: preset.penetration.observations.map(
              (observation) => observation.penetration
            )
          }
        : {
            mode: "fixed",
            value:
              preset.penetration.mode === "fixed"
                ? preset.penetration.penetration
                : preset.penetration.fallbackPenetration
          };

  return {
    id: presetOverrideId(preset.id),
    name: presetLabel(preset),
    penetration,
    shuffle: "perfect_random",
    rules: {
      ...preset.rules,
      deviationProfile: preset.deviationSetId
    }
  };
}

function ruleSummary(game: StoredCustomGame): string {
  const das = game.rules.doubleAfterSplit ? "DAS" : "No DAS";
  return [
    `${String(game.rules.decks)} deck`,
    String(game.rules.blackjackPayout),
    String(game.rules.dealerSoft17),
    das
  ].join(" / ");
}

function GameRow({
  game,
  kind,
  deletable,
  onDeleted,
  onSaved,
  retainedAfterDelete,
  setupId,
  submitLabel
}: {
  readonly game: StoredCustomGame;
  readonly kind: string;
  readonly deletable: boolean;
  readonly onDeleted: () => void;
  readonly onSaved?: (gameId: string) => void;
  readonly retainedAfterDelete: boolean;
  readonly setupId: string;
  readonly submitLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = `game-${game.id}`;
  const editorId = `editor-${game.id}`;

  function handleDeleted() {
    setEditing(false);
    onDeleted();
    if (retainedAfterDelete) {
      queueMicrotask(() => editButtonRef.current?.focus());
    }
  }

  return (
    <article aria-labelledby={headingId} className={styles.gameRow}>
      <div className={styles.gameIdentity}>
        <span>{kind}</span>
        <h3 id={headingId}>{game.name}</h3>
        <p>{ruleSummary(game)}</p>
      </div>
      <div className={styles.rowActions}>
        <Link href={`/setup?preset=${encodeURIComponent(setupId)}`}>
          Practice
        </Link>
        <button
          aria-controls={editorId}
          aria-expanded={editing}
          aria-label={`${editing ? "Close" : "Edit"} ${game.name}`}
          onClick={() => setEditing((open) => !open)}
          ref={editButtonRef}
          type="button"
        >
          {editing ? "Close" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div className={styles.editor} id={editorId}>
          <CustomGameForm
            deletable={deletable}
            initialGame={game}
            onDeleted={handleDeleted}
            submitLabel={submitLabel}
            {...(onSaved === undefined ? {} : { onSaved })}
          />
        </div>
      ) : null}
    </article>
  );
}

export function GameCatalog() {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const addGameButtonRef = useRef<HTMLButtonElement>(null);
  const customGames = useAppData().customGames;
  const overrideById = new Map(customGames.map((game) => [game.id, game]));
  const standaloneGames = customGames.filter(
    (game) => !PRESET_OVERRIDE_IDS.has(game.id)
  );

  return (
    <div className={styles.catalog}>
      <section aria-labelledby="preset-games-heading">
        <div className={styles.listHeading}>
          <h2 id="preset-games-heading">Preset games</h2>
          <span>{BLACK_HAWK_PRESETS.length}</span>
        </div>
        <div className={styles.gameList}>
          {BLACK_HAWK_PRESETS.map((preset) => {
            const override = overrideById.get(presetOverrideId(preset.id));
            const game = override ?? presetAsCustomGame(preset);
            return (
              <GameRow
                deletable={override !== undefined}
                game={game}
                key={preset.id}
                kind={override === undefined ? "Preset" : "Edited preset"}
                onDeleted={() => {
                  replaceSelectedGameId(game.id, preset.id);
                  setStatus(`Deleted edits to ${game.name}.`);
                }}
                onSaved={(gameId) => {
                  migrateSelectedGameId(preset.id, gameId);
                }}
                retainedAfterDelete
                setupId={override?.id ?? preset.id}
                submitLabel="Save edited game"
              />
            );
          })}
        </div>
      </section>

      {standaloneGames.length === 0 ? null : (
        <section aria-labelledby="saved-games-heading">
          <div className={styles.listHeading}>
            <h2 id="saved-games-heading">Saved games</h2>
            <span>{standaloneGames.length}</span>
          </div>
          <div className={styles.gameList}>
            {standaloneGames.map((game) => (
              <GameRow
                deletable
                game={game}
                key={game.id}
                kind="Saved"
                onDeleted={() => {
                  replaceSelectedGameId(game.id, DEFAULT_SELECTED_GAME_ID);
                  setStatus(`Deleted ${game.name}.`);
                  queueMicrotask(() => addGameButtonRef.current?.focus());
                }}
                retainedAfterDelete={false}
                setupId={game.id}
                submitLabel="Save changes"
              />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Add a game" className={styles.addGame}>
        <button
          aria-controls="new-game-editor"
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
          ref={addGameButtonRef}
          type="button"
        >
          {adding ? "Close" : "Add game"}
        </button>
        {adding ? (
          <div id="new-game-editor">
            <CustomGameForm />
          </div>
        ) : null}
      </section>
      <p aria-live="polite" className={styles.catalogStatus}>
        {status}
      </p>
    </div>
  );
}
