"use client";

import { BLACK_HAWK_PRESETS } from "@trueedge/casino-catalog";
import {
  evaluateDeviation,
  evaluateInsuranceDeviation,
  recommendBasicStrategy,
  resolveDeviationProfileForRules,
  type PlayerAction,
  type TableView
} from "@trueedge/game-core";
import { useEffect, useId, useMemo, useRef } from "react";

import { betUnitsForTrueCount, wagerForUnits } from "../../lib/betRamp";
import { formatCents } from "../../lib/format";
import { updateSelectedGameId } from "../../lib/gamePreference";
import { useAppData } from "../../lib/useAppData";
import styles from "./BlackjackTable.module.css";

export type TrainingMode = "play" | "observation" | "practice" | "decision";

export interface DecisionGuide {
  readonly action: PlayerAction;
  readonly basicAction: PlayerAction;
  readonly explanation: string;
  readonly deviation: boolean;
  readonly index: number | null;
  readonly profileId: string;
}

interface DisplayDecision {
  readonly action: string;
  readonly explanation: string;
  readonly index: number | null;
  readonly label: string;
}

interface WagerSignal {
  readonly action: string;
  readonly explanation: string;
}

const HI_LO_REFERENCE = [
  { ranks: "2 3 4 5 6", value: "+1" },
  { ranks: "7 8 9", value: "0" },
  { ranks: "10 J Q K A", value: "-1" }
] as const;

export function deriveDeviationProfileId(view: TableView): string {
  return resolveDeviationProfileForRules(view.rules, view.deviationProfileId);
}

export function deriveDecisionGuide(view: TableView): DecisionGuide | null {
  const dealerUpCard = view.dealerCards[0];
  if (
    dealerUpCard === null ||
    dealerUpCard === undefined ||
    view.playerCards.length === 0 ||
    view.phase !== "player"
  ) {
    return null;
  }

  const input = {
    playerCards: view.playerCards,
    dealerUpCard,
    rules: view.rules,
    canDouble: view.canDouble,
    canSplit: view.canSplit,
    canSurrender: view.canSurrender,
    afterSplit: view.playerHands.length > 1,
    splitHands: view.playerHands.length
  };
  const basic = recommendBasicStrategy(input);
  const profile = deriveDeviationProfileId(view);
  if (profile === "basic-strategy-only") {
    return {
      action: basic.action,
      basicAction: basic.action,
      explanation: `${basic.explanation} No compatible Hi-Lo index profile is selected for these rules.`,
      deviation: false,
      index: null,
      profileId: profile
    };
  }
  const deviation = evaluateDeviation({
    ...input,
    profile,
    trueCount: view.count.trueCountResolved
  });

  return {
    action:
      deviation.opportunity && deviation.eligible
        ? deviation.action
        : basic.action,
    basicAction: basic.action,
    explanation: deviation.opportunity
      ? deviation.explanation
      : basic.explanation,
    deviation: deviation.opportunity && deviation.eligible,
    index: deviation.entry?.index ?? null,
    profileId: profile
  };
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function actionLabel(action: string): string {
  if (action === "insurance") return "Take insurance";
  if (action === "decline") return "Decline insurance";
  return `${action[0]?.toUpperCase() ?? ""}${action.slice(1)}`;
}

function deriveInsuranceGuide(view: TableView): DisplayDecision | null {
  if (view.phase !== "insurance") return null;
  const profile = deriveDeviationProfileId(view);
  if (profile === "basic-strategy-only") {
    return {
      action: "Decline insurance",
      explanation:
        "No compatible count-based insurance profile is selected, so decline insurance.",
      index: null,
      label: "Insurance decision"
    };
  }
  const decision = evaluateInsuranceDeviation({
    profile,
    rules: view.rules,
    trueCount: view.count.trueCountResolved
  });
  return {
    action: actionLabel(decision.action),
    explanation: decision.explanation,
    index: decision.entry.index,
    label: "Insurance decision"
  };
}

function deriveDisplayDecision({
  decisionFeedback,
  guide,
  lastFeedback,
  reveal,
  selectedWagerCents,
  view
}: {
  readonly decisionFeedback: boolean;
  readonly guide: DecisionGuide | null;
  readonly lastFeedback: string | null;
  readonly reveal: boolean;
  readonly selectedWagerCents: number | null;
  readonly view: TableView;
}): DisplayDecision {
  if (decisionFeedback && !reveal && lastFeedback !== null) {
    return {
      action: lastFeedback.startsWith("Correct:") ? "Correct" : "Review",
      explanation: lastFeedback,
      index: null,
      label: "Decision feedback"
    };
  }

  if (!reveal && (view.phase === "player" || view.phase === "insurance")) {
    return {
      action: "Make your play",
      explanation: "Decision guidance appears after the hand.",
      index: null,
      label: "Next decision"
    };
  }

  const insurance = deriveInsuranceGuide(view);
  if (insurance !== null) return insurance;

  if (view.phase === "player" && guide !== null) {
    return {
      action: actionLabel(guide.action),
      explanation: guide.explanation,
      index: guide.index,
      label: "Next decision"
    };
  }

  if (
    (view.phase === "settled" || view.phase === "stopped") &&
    guide !== null
  ) {
    return {
      action: actionLabel(guide.action),
      explanation: lastFeedback ?? guide.explanation,
      index: guide.index,
      label: "Last decision"
    };
  }

  if (view.phase === "stopped") {
    return {
      action: "Session complete",
      explanation: "Review the completed hands or export the replay.",
      index: null,
      label: "Session"
    };
  }

  const readyWagerCents =
    view.pendingBetCents > 0 ? view.pendingBetCents : selectedWagerCents;
  if (readyWagerCents !== null) {
    return {
      action: "Deal the hand",
      explanation: `${formatCents(readyWagerCents)} is selected. Deal when ready.`,
      index: null,
      label: "Next step"
    };
  }

  return {
    action: "Choose a wager",
    explanation: "Your selected wager stays ready for the next Deal.",
    index: null,
    label: "Next step"
  };
}

function deriveWagerSignal(
  view: TableView,
  reveal: boolean,
  tableMinimumCents: number
): WagerSignal {
  if (view.phase === "stopped") {
    return {
      action: "Session complete",
      explanation: "No additional wager is available in this session."
    };
  }
  if (!reveal) {
    return {
      action: "Check after the hand",
      explanation: "Count-based wager guidance stays hidden during play."
    };
  }
  if (view.shoe.shuffleMode === "continuous") {
    return {
      action: `Stay at 1 unit (${formatCents(tableMinimumCents)})`,
      explanation: "This CSM model resets the traditional count between hands."
    };
  }
  if (view.shoe.shufflePending) {
    return {
      action: `Reset to 1 unit (${formatCents(tableMinimumCents)})`,
      explanation:
        "The shoe shuffles and the count resets before the next hand."
    };
  }
  const trueCount = view.count.trueCountResolved;
  const units = betUnitsForTrueCount(trueCount);
  const uncappedWagerCents = units * tableMinimumCents;
  const wagerCents = wagerForUnits(
    units,
    tableMinimumCents,
    view.limits.maxBetCents
  );
  if (units > 1) {
    const target =
      wagerCents < uncappedWagerCents
        ? `${units}-unit target, ${formatCents(wagerCents)} cap`
        : `${units} units (${formatCents(wagerCents)})`;
    const nextStep =
      units === 8
        ? "This is the top of the 1-2-4-6-8 training ramp."
        : `Move to ${betUnitsForTrueCount(trueCount + 1)} units at TC ${signed(trueCount + 1)}.`;
    return {
      action:
        view.phase === "betting" || view.phase === "settled"
          ? `Set ${target}`
          : `Next hand: ${target}`,
      explanation: `Current TC ${signed(trueCount)}. ${nextStep}`
    };
  }
  return {
    action: `Stay at 1 unit (${formatCents(tableMinimumCents)})`,
    explanation: `Move to 2 units at TC +1. Current TC ${signed(trueCount)}.`
  };
}

export function TrainingRail({
  view,
  mode,
  lastFeedback,
  decisionFeedbackLog,
  settledGuide,
  selectedWagerCents,
  tableMinimumCents,
  currentPresetId
}: {
  readonly view: TableView;
  readonly mode: TrainingMode;
  readonly lastFeedback: string | null;
  readonly decisionFeedbackLog: readonly string[];
  readonly settledGuide?: DecisionGuide | null;
  readonly selectedWagerCents: number | null;
  readonly tableMinimumCents: number;
  readonly currentPresetId: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const gameSelectId = useId();
  const customGames = useAppData().customGames;
  const availablePresetIds = useMemo(
    () =>
      new Set([...BLACK_HAWK_PRESETS, ...customGames].map((game) => game.id)),
    [customGames]
  );
  const selectedPresetId = availablePresetIds.has(currentPresetId)
    ? currentPresetId
    : "";
  const liveGuide = useMemo(() => deriveDecisionGuide(view), [view]);
  const guide = liveGuide ?? settledGuide ?? null;
  const live = mode === "observation";
  const roundOver = view.phase === "settled" || view.phase === "stopped";
  const reveal = live || roundOver;
  const decisionFeedback = mode === "decision" && lastFeedback !== null;
  const progress = Math.min(
    100,
    view.shoe.cutIndex === 0
      ? 0
      : (view.shoe.cardsDealt / view.shoe.cutIndex) * 100
  );
  const displayDecision = deriveDisplayDecision({
    decisionFeedback,
    guide,
    lastFeedback: live ? null : lastFeedback,
    reveal,
    selectedWagerCents,
    view
  });
  const wagerSignal = deriveWagerSignal(view, reveal, tableMinimumCents);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (detailsRef.current !== null) {
      detailsRef.current.open = media === undefined || !media.matches;
    }
  }, []);

  return (
    <details className={styles.trainingRail} ref={detailsRef}>
      <summary>
        <span>Decision guide</span>
        <strong>{displayDecision.action}</strong>
      </summary>
      <div className={styles.railBody}>
        <section aria-label="Game selection" className={styles.gameChooser}>
          <form action="/setup" method="get">
            <label htmlFor={gameSelectId}>Game preset</label>
            <select
              defaultValue={selectedPresetId}
              id={gameSelectId}
              key={
                selectedPresetId === ""
                  ? "custom-preset-loading"
                  : selectedPresetId
              }
              name="preset"
              onChange={(event) => updateSelectedGameId(event.target.value)}
            >
              {selectedPresetId === "" ? (
                <option disabled value="">
                  Current custom rules
                </option>
              ) : null}
              <optgroup label="Preset games">
                {BLACK_HAWK_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.venue} {preset.name}
                  </option>
                ))}
              </optgroup>
              {customGames.length === 0 ? null : (
                <optgroup label="Saved games">
                  {customGames.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} (saved)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button type="submit">Set up game</button>
          </form>
        </section>

        <section
          aria-label="Decision explanation"
          aria-live="polite"
          className={styles.decisionCard}
        >
          <span>{displayDecision.label}</span>
          <h2>{displayDecision.action}</h2>
          <p>{displayDecision.explanation}</p>
          {displayDecision.index === null || !reveal ? null : (
            <dl className={styles.decisionMeta}>
              <div>
                <dt>Index trigger</dt>
                <dd>TC {signed(displayDecision.index)}</dd>
              </div>
              <div>
                <dt>Current TC</dt>
                <dd>{signed(view.count.trueCountResolved)}</dd>
              </div>
            </dl>
          )}
        </section>

        <section aria-label="Count snapshot" className={styles.countSnapshot}>
          <dl>
            <div>
              <dt>Running</dt>
              <dd>{reveal ? signed(view.count.runningCount) : "--"}</dd>
            </div>
            <div>
              <dt>True count</dt>
              <dd>{reveal ? signed(view.count.trueCountResolved) : "--"}</dd>
            </div>
            <div>
              <dt>Decks left</dt>
              <dd>
                {reveal ? view.count.decksRemainingEstimated.toFixed(1) : "--"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-label="Hi-Lo card values"
          className={styles.countReference}
        >
          <span>Hi-Lo card values</span>
          <dl>
            {HI_LO_REFERENCE.map((group) => (
              <div key={group.value}>
                <dt>{group.value}</dt>
                <dd>{group.ranks}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Wager guidance" className={styles.wagerGuide}>
          <span>Wager signal</span>
          <strong>{wagerSignal.action}</strong>
          <p>{wagerSignal.explanation}</p>
        </section>

        {decisionFeedbackLog.length === 0 ? null : (
          <section
            className={styles.decisionLog}
            aria-label="Decision feedback log"
          >
            <span>Decisions this hand</span>
            <ol>
              {decisionFeedbackLog.map((feedback, index) => (
                <li key={`${index}-${feedback}`}>{feedback}</li>
              ))}
            </ol>
          </section>
        )}

        <div className={styles.shoeMeter}>
          <div>
            <span>Shoe to cut</span>
            <strong>{reveal ? `${Math.round(progress)}%` : "--"}</strong>
          </div>
          <progress
            aria-label="Shoe penetration"
            max={100}
            value={reveal ? progress : 0}
          />
          <p>
            {!reveal
              ? "Shoe position appears after the hand."
              : view.shoe.shuffleMode === "continuous"
                ? "Count resets between hands."
                : view.shoe.shufflePending
                  ? "Shuffle before the next hand."
                  : `${view.shoe.cardsRemaining} cards remain in the shoe.`}
          </p>
        </div>
      </div>
    </details>
  );
}
