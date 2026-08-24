"use client";

import { useEffect, useMemo, useState } from "react";

import { updateSelectedGameId } from "../../lib/gamePreference";
import { useAppData } from "../../lib/useAppData";
import styles from "./SessionSetupForm.module.css";

const MODES = [
  {
    id: "play",
    label: "Play",
    detail: "Wrong moves flag now; full feedback follows the round."
  },
  {
    id: "observation",
    label: "Observation",
    detail: "Count, strategy, and index logic stay visible."
  },
  {
    id: "practice",
    label: "Practice",
    detail: "Maintain the count while playing full hands."
  },
  {
    id: "decision",
    label: "Decision",
    detail: "Score every play against strategy and deviations."
  }
] as const;

const INTENTS = [
  ["full_game", "Full game"],
  ["basic_strategy", "Basic strategy"],
  ["running_count", "Running count"],
  ["deck_estimation", "Deck estimation"],
  ["true_count", "True count"],
  ["deviations", "Deviations"],
  ["discipline", "Discipline"]
] as const;

type TrainingModeId = (typeof MODES)[number]["id"];
type IntentId = (typeof INTENTS)[number][0];

function intentSupported(
  mode: TrainingModeId,
  intent: IntentId,
  supportsDeviations: boolean
): boolean {
  if (intent === "discipline") return true;
  if (mode === "observation") return false;
  if (intent === "deviations" && !supportsDeviations) return false;
  if (
    intent === "running_count" ||
    intent === "deck_estimation" ||
    intent === "true_count"
  ) {
    return mode === "practice";
  }
  return true;
}

function compatibleModeForIntent(
  mode: TrainingModeId,
  intent: IntentId,
  supportsDeviations: boolean
): TrainingModeId {
  if (intentSupported(mode, intent, supportsDeviations)) return mode;
  if (
    intent === "running_count" ||
    intent === "deck_estimation" ||
    intent === "true_count"
  ) {
    return "practice";
  }
  if (intent === "full_game") return "play";
  return "decision";
}

function dollarsToCents(value: string): number {
  const dollars = Number(value);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}

export function SessionSetupForm({
  presetId,
  tableMinimumCents
}: {
  readonly presetId: string;
  readonly tableMinimumCents: number;
}) {
  const [bankroll, setBankroll] = useState("300");
  const [stopLoss, setStopLoss] = useState("150");
  const [winStop, setWinStop] = useState("250");
  const [maxBet, setMaxBet] = useState("50");
  const [selectedMode, setSelectedMode] =
    useState<TrainingModeId>("observation");
  const [intent, setIntent] = useState<IntentId>("discipline");
  const customGame =
    useAppData().customGames.find((game) => game.id === presetId) ?? null;
  const customDeviationProfile = customGame?.rules.deviationProfile;
  const supportsDeviations =
    customGame === null ||
    (typeof customDeviationProfile === "string" &&
      customDeviationProfile !== "basic-strategy-only");

  useEffect(() => {
    updateSelectedGameId(presetId);
  }, [presetId]);

  const error = useMemo(() => {
    const bankrollCents = dollarsToCents(bankroll);
    const stopLossCents = dollarsToCents(stopLoss);
    const maxBetCents = dollarsToCents(maxBet);
    if (bankrollCents <= 0) return "Starting bankroll must be positive.";
    if (stopLossCents <= 0 || stopLossCents > bankrollCents) {
      return "Stop-loss must fit inside the starting bankroll.";
    }
    if (maxBetCents <= 0 || maxBetCents > bankrollCents) {
      return "Maximum bet must fit inside the starting bankroll.";
    }
    if (maxBetCents < tableMinimumCents) {
      return `Maximum bet must cover the ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(tableMinimumCents / 100)} table minimum.`;
    }
    if (dollarsToCents(winStop) <= 0) return "Win stop must be positive.";
    return null;
  }, [bankroll, maxBet, stopLoss, tableMinimumCents, winStop]);

  return (
    <form action="/play" className={styles.form} method="get">
      <input name="preset" type="hidden" value={presetId} />
      <input name="minBet" type="hidden" value={tableMinimumCents / 100} />
      {customGame === null ? null : (
        <>
          <input name="customName" type="hidden" value={customGame.name} />
          <input
            name="rulesDecks"
            type="hidden"
            value={String(customGame.rules.decks)}
          />
          <input
            name="rulesPayout"
            type="hidden"
            value={String(customGame.rules.blackjackPayout)}
          />
          <input
            name="rulesSoft17"
            type="hidden"
            value={String(customGame.rules.dealerSoft17)}
          />
          <input
            name="rulesDouble"
            type="hidden"
            value={String(customGame.rules.doubleRule)}
          />
          <input
            name="rulesDas"
            type="hidden"
            value={String(customGame.rules.doubleAfterSplit)}
          />
          <input
            name="rulesSurrender"
            type="hidden"
            value={String(customGame.rules.surrender)}
          />
          <input
            name="rulesMaxSplit"
            type="hidden"
            value={String(customGame.rules.maxSplitHands)}
          />
          <input
            name="rulesRsa"
            type="hidden"
            value={String(customGame.rules.resplitAces)}
          />
          <input
            name="rulesHsa"
            type="hidden"
            value={String(customGame.rules.hitSplitAces)}
          />
          <input
            name="rulesDsa"
            type="hidden"
            value={String(customGame.rules.doubleSplitAces)}
          />
          <input
            name="rulesPeek"
            type="hidden"
            value={String(customGame.rules.dealerPeek)}
          />
          <input
            name="rulesBurn"
            type="hidden"
            value={String(customGame.rules.burnCard)}
          />
          <input
            name="penetrationMode"
            type="hidden"
            value={customGame.penetration.mode}
          />
          {customGame.penetration.mode === "fixed" ? (
            <input
              name="penetration"
              type="hidden"
              value={customGame.penetration.value}
            />
          ) : customGame.penetration.mode === "range" ? (
            <>
              <input
                name="penetrationMin"
                type="hidden"
                value={customGame.penetration.minimum}
              />
              <input
                name="penetrationMax"
                type="hidden"
                value={customGame.penetration.maximum}
              />
            </>
          ) : (
            <input
              name="penetrationValues"
              type="hidden"
              value={customGame.penetration.values.join(",")}
            />
          )}
          <input name="shuffle" type="hidden" value={customGame.shuffle} />
          <input
            name="deviationProfile"
            type="hidden"
            value={String(
              customGame.rules.deviationProfile ?? "basic-strategy-only"
            )}
          />
        </>
      )}

      {customGame === null ? null : (
        <section className={styles.customNotice}>
          <span>Custom game loaded</span>
          <strong>{customGame.name}</strong>
          <p>
            {customGame.shuffle === "continuous"
              ? "Continuous-shuffler approximation returns a deterministic portion of the discard pool between rounds and resets the traditional running count."
              : "Rules and shuffle behavior are locked from your local game profile."}
          </p>
        </section>
      )}

      <fieldset className={styles.section}>
        <legend>Training mode</legend>
        <p>Choose how much reasoning the table reveals while you play.</p>
        <div className={styles.modeGrid}>
          {MODES.map((modeOption) => (
            <label className={styles.choice} key={modeOption.id}>
              <input
                aria-label={modeOption.label}
                checked={modeOption.id === selectedMode}
                name="mode"
                onChange={() => {
                  setSelectedMode(modeOption.id);
                  if (
                    !intentSupported(modeOption.id, intent, supportsDeviations)
                  ) {
                    setIntent(
                      modeOption.id === "observation"
                        ? "discipline"
                        : "full_game"
                    );
                  }
                }}
                type="radio"
                value={modeOption.id}
              />
              <span>
                <strong>{modeOption.label}</strong>
                <small>{modeOption.detail}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Session intent</legend>
        <p>
          The recap gives this skill more weight. Choosing an intent switches to
          a compatible training mode when needed.
        </p>
        <div className={styles.intentGrid}>
          {INTENTS.map(([id, label]) => (
            <label className={styles.compactChoice} key={id}>
              <input
                checked={intent === id}
                disabled={id === "deviations" && !supportsDeviations}
                name="intent"
                onChange={() => {
                  setSelectedMode(
                    compatibleModeForIntent(
                      selectedMode,
                      id,
                      supportsDeviations
                    )
                  );
                  setIntent(id);
                }}
                type="radio"
                value={id}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Hard session limits</legend>
        <p>
          These values lock when the session begins. Limits can tighten, never
          loosen, while a shoe is active.
        </p>
        <div className={styles.fields}>
          <label>
            <span>Starting bankroll</span>
            <div className={styles.moneyInput}>
              <b>$</b>
              <input
                inputMode="decimal"
                min="1"
                name="bankroll"
                onChange={(event) => setBankroll(event.target.value)}
                required
                step="1"
                type="number"
                value={bankroll}
              />
            </div>
          </label>
          <label>
            <span>Stop-loss</span>
            <div className={styles.moneyInput}>
              <b>$</b>
              <input
                inputMode="decimal"
                min="1"
                name="stopLoss"
                onChange={(event) => setStopLoss(event.target.value)}
                required
                step="1"
                type="number"
                value={stopLoss}
              />
            </div>
          </label>
          <label>
            <span>Win stop</span>
            <div className={styles.moneyInput}>
              <b>+$</b>
              <input
                inputMode="decimal"
                min="1"
                name="winStop"
                onChange={(event) => setWinStop(event.target.value)}
                required
                step="1"
                type="number"
                value={winStop}
              />
            </div>
          </label>
          <label>
            <span>Maximum bet</span>
            <div className={styles.moneyInput}>
              <b>$</b>
              <input
                inputMode="decimal"
                min="1"
                name="maxBet"
                onChange={(event) => setMaxBet(event.target.value)}
                required
                step="1"
                type="number"
                value={maxBet}
              />
            </div>
          </label>
          <label>
            <span>Hand limit</span>
            <input
              defaultValue="100"
              min="1"
              name="hands"
              required
              step="1"
              type="number"
            />
          </label>
          <label>
            <span>Duration</span>
            <select defaultValue="60" name="minutes">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
        </div>
        {error === null ? null : (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Count conventions</legend>
        <div className={styles.fields}>
          <label>
            <span>Deck estimation</span>
            <select defaultValue="half" name="estimation">
              <option value="exact">Exact</option>
              <option value="quarter">Quarter deck</option>
              <option value="half">Half deck</option>
              <option value="whole">Whole deck</option>
            </select>
          </label>
          <label>
            <span>True-count resolution</span>
            <select defaultValue="truncate" name="resolution">
              <option value="truncate">Truncate</option>
              <option value="floor">Floor</option>
              <option value="nearest">Nearest</option>
            </select>
          </label>
          <label>
            <span>Session seed</span>
            <input
              defaultValue="785390425"
              max="4294967295"
              min="0"
              name="seed"
              required
              type="number"
            />
          </label>
        </div>
      </fieldset>

      <div className={styles.submitRow}>
        <div>
          <strong>Virtual practice only</strong>
          <span>No deposits, wagers, accounts, or casino connection.</span>
        </div>
        <button disabled={error !== null} type="submit">
          Lock limits and start
        </button>
      </div>
    </form>
  );
}
