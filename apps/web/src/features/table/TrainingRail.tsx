"use client";

import {
  evaluateDeviation,
  recommendBasicStrategy,
  resolveDeviationProfileForRules,
  type PlayerAction,
  type TableView
} from "@trueedge/game-core";
import { useEffect, useMemo, useRef } from "react";

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

export function TrainingRail({
  view,
  mode,
  lastFeedback,
  decisionFeedbackLog,
  settledGuide
}: {
  readonly view: TableView;
  readonly mode: TrainingMode;
  readonly lastFeedback: string | null;
  readonly decisionFeedbackLog: readonly string[];
  readonly settledGuide?: DecisionGuide | null;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
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

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (detailsRef.current !== null) {
      detailsRef.current.open = media === undefined || !media.matches;
    }
  }, []);

  return (
    <details className={styles.trainingRail} ref={detailsRef}>
      <summary>
        <span>Training rail</span>
        <strong>
          {reveal ? `TC ${signed(view.count.trueCountResolved)}` : "Hidden"}
        </strong>
      </summary>
      <div className={styles.railBody}>
        <header className={styles.railHeading}>
          <div>
            <span>{mode} mode</span>
            <h2>
              {live
                ? "Live analysis"
                : decisionFeedback
                  ? "Decision feedback"
                  : "Post-hand review"}
            </h2>
          </div>
          <b>{live ? "LIVE" : "LOCKED"}</b>
        </header>

        <div className={styles.countPair}>
          <div>
            <span>Running count</span>
            <strong>{reveal ? signed(view.count.runningCount) : "--"}</strong>
          </div>
          <div>
            <span>True count</span>
            <strong>
              {reveal ? signed(view.count.trueCountResolved) : "--"}
            </strong>
          </div>
        </div>

        <dl className={styles.metrics}>
          <div>
            <dt>Cards seen</dt>
            <dd>{reveal ? view.count.cardsSeen : "--"}</dd>
          </div>
          <div>
            <dt>Last card to RC</dt>
            <dd>
              {!reveal || view.count.lastExposedCard === null
                ? "--"
                : `${view.count.lastExposedCard.rank} -> ${signed(view.count.lastCardCountValue ?? 0)}`}
            </dd>
          </div>
          <div>
            <dt>Decks remain</dt>
            <dd>
              {reveal ? view.count.decksRemainingEstimated.toFixed(1) : "--"}
            </dd>
          </div>
          <div>
            <dt>Raw true count</dt>
            <dd>{reveal ? view.count.trueCountRaw.toFixed(2) : "--"}</dd>
          </div>
          <div>
            <dt>Convention</dt>
            <dd>
              {view.countSettings.estimation} / {view.countSettings.resolution}
            </dd>
          </div>
          <div>
            <dt>Basic play</dt>
            <dd>
              {reveal ? (guide?.basicAction.toUpperCase() ?? "WAIT") : "--"}
            </dd>
          </div>
          <div>
            <dt>Indexed play</dt>
            <dd>
              {reveal && guide?.deviation
                ? guide.action.toUpperCase()
                : reveal
                  ? "NONE"
                  : "--"}
            </dd>
          </div>
          <div>
            <dt>Profile / index</dt>
            <dd>
              {reveal && guide !== null
                ? `${guide.profileId.replace("hi-lo-", "")} / ${guide.index ?? "--"}`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Discard tray</dt>
            <dd>{reveal ? `${view.shoe.cardsDealt} cards` : "--"}</dd>
          </div>
        </dl>

        <section
          aria-label="Decision explanation"
          aria-live="polite"
          className={styles.analysisNote}
        >
          <span>Why</span>
          <p>
            {live
              ? (guide?.explanation ?? "Deal a hand to see the decision model.")
              : reveal || decisionFeedback
                ? (lastFeedback ??
                  guide?.explanation ??
                  "Deal a hand to see the decision model.")
                : "Analysis stays hidden until the round settles."}
          </p>
        </section>

        {decisionFeedbackLog.length === 0 ? null : (
          <section
            className={styles.decisionLog}
            aria-label="Decision feedback log"
          >
            <span>Decisions this round</span>
            <ol>
              {decisionFeedbackLog.map((feedback, index) => (
                <li key={`${index}-${feedback}`}>{feedback}</li>
              ))}
            </ol>
          </section>
        )}

        <div className={styles.shoeMeter}>
          <div>
            <span>Shoe position</span>
            <strong>{reveal ? `${Math.round(progress)}%` : "--"}</strong>
          </div>
          <progress
            aria-label="Shoe penetration"
            max={100}
            value={reveal ? progress : 0}
          />
          <p>
            {!reveal
              ? "Shoe analysis unlocks when the round settles."
              : view.shoe.shuffleMode === "continuous"
                ? "Continuous-shuffler approximation progressively returns dealt cards between rounds, so a traditional multi-round running count does not carry forward."
                : view.shoe.shufflePending
                  ? "Cut reached. The count resets before the next round."
                  : "Only exposed cards enter the running count."}
          </p>
        </div>
      </div>
    </details>
  );
}
