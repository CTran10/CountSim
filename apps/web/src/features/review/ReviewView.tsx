"use client";

import {
  evaluateHand,
  replayTableTimeline,
  type Card,
  type SessionCommand,
  type SessionReplay,
  type TableView
} from "@trueedge/game-core";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCents } from "../../lib/format";
import { SKILL_IDS } from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";
import sectionStyles from "../../app/sections.module.css";
import styles from "./ReviewView.module.css";

const CATEGORY_LABELS = {
  basic_strategy: "Basic strategy",
  running_count: "Running count",
  deck_estimation: "Deck estimation",
  true_count: "True count",
  deviations: "Deviation",
  insurance: "Insurance"
} as const;

const INTENT_LABELS: Readonly<Record<string, string>> = {
  basic_strategy: "Basic strategy",
  running_count: "Running count",
  deck_estimation: "Deck estimation",
  true_count: "True count",
  deviation: "Deviations",
  discipline: "Discipline",
  full_game: "Full game"
};

const DECISION_COMMANDS = new Set<SessionCommand["type"]>([
  "hit",
  "stand",
  "double",
  "split",
  "surrender",
  "insurance",
  "decline_insurance",
  "submit_count",
  "submit_deck_estimate",
  "submit_true_count"
]);

interface ReviewCheckpoint {
  readonly commandIndex: number;
  readonly handNumber: number;
  readonly label: string;
  readonly view: TableView;
}

interface SessionSelection {
  readonly sessionId: string;
  readonly index: number;
}

function commandLabel(command: SessionCommand): string {
  return command.type.replaceAll("_", " ");
}

function activeHandNumber(view: TableView): number {
  return view.phase === "player" || view.phase === "insurance"
    ? view.analytics.handsPlayed + 1
    : Math.max(1, view.analytics.handsPlayed);
}

function buildReviewCheckpoints(
  replay: SessionReplay
): readonly ReviewCheckpoint[] {
  const frames = replayTableTimeline(replay);
  const checkpoints = new Map<number, ReviewCheckpoint>();
  for (const [index, command] of replay.successfulCommands.entries()) {
    const before = frames[index]!;
    const after = frames[index + 1]!;
    if (command.type === "deal") {
      checkpoints.set(index + 1, {
        commandIndex: index + 1,
        handNumber: activeHandNumber(after.view),
        label: `Hand ${activeHandNumber(after.view)} · initial deal`,
        view: after.view
      });
    }
    if (DECISION_COMMANDS.has(command.type)) {
      checkpoints.set(index, {
        commandIndex: index,
        handNumber: activeHandNumber(before.view),
        label: `Hand ${activeHandNumber(before.view)} · before ${commandLabel(command)}`,
        view: before.view
      });
    }
    if (after.view.result !== null && before.view.result === null) {
      checkpoints.set(index + 1, {
        commandIndex: index + 1,
        handNumber: activeHandNumber(after.view),
        label: `Hand ${activeHandNumber(after.view)} · ${after.view.result.message}`,
        view: after.view
      });
    }
  }
  if (checkpoints.size === 0) {
    const finalFrame = frames.at(-1)!;
    checkpoints.set(finalFrame.commandIndex, {
      commandIndex: finalFrame.commandIndex,
      handNumber: activeHandNumber(finalFrame.view),
      label: "Session state",
      view: finalFrame.view
    });
  }
  return [...checkpoints.values()].sort(
    (left, right) => left.commandIndex - right.commandIndex
  );
}

function cardLabel(card: Card | null): string {
  if (card === null) return "Hidden";
  const suit = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" }[
    card.suit
  ];
  return `${card.rank}${suit}`;
}

function averageDecisionTime(replay: SessionReplay): number | null {
  if (replay.commandElapsedMs === undefined) return null;
  const times = replay.successfulCommands.flatMap((command, index) => {
    if (!DECISION_COMMANDS.has(command.type)) return [];
    const current = replay.commandElapsedMs?.[index];
    if (current === undefined) return [];
    const previous =
      index === 0 ? 0 : (replay.commandElapsedMs?.[index - 1] ?? 0);
    return [current - previous];
  });
  return times.length === 0
    ? null
    : times.reduce((sum, time) => sum + time, 0) / times.length;
}

export function ReviewView() {
  const data = useAppData();
  const [checkpointSelection, setCheckpointSelection] =
    useState<SessionSelection | null>(null);
  const [mistakeSelection, setMistakeSelection] =
    useState<SessionSelection | null>(null);

  const session = data.sessions[0];
  const checkpoints = useMemo(
    () =>
      session?.replay === null || session?.replay === undefined
        ? []
        : buildReviewCheckpoints(session.replay),
    [session]
  );
  const checkpointIndex =
    session !== undefined && checkpointSelection?.sessionId === session.id
      ? checkpointSelection.index
      : null;
  const focusedMistakeIndex =
    session !== undefined && mistakeSelection?.sessionId === session.id
      ? mistakeSelection.index
      : null;
  const visibleCheckpointIndex = Math.min(
    checkpointIndex ?? Math.max(0, checkpoints.length - 1),
    Math.max(0, checkpoints.length - 1)
  );
  const checkpoint = checkpoints[visibleCheckpointIndex] ?? null;
  const replayView = checkpoint?.view ?? null;
  if (session === undefined) {
    return (
      <section className={sectionStyles.emptyState}>
        <h2>No completed session yet</h2>
        <p>
          Finish a table session to inspect strategy, count, deck-estimation,
          true-count, and deviation errors hand by hand.
        </p>
        <Link className={sectionStyles.actionLink} href="/games">
          Choose a training game
        </Link>
      </section>
    );
  }

  const net = session.endingBankrollCents - session.startingBankrollCents;
  const replay = session.replay;
  const activeHand =
    replayView?.playerHands[replayView.activeHandIndex] ??
    replayView?.playerHands[0] ??
    null;
  const nextCommand =
    replay === null || checkpoint === null
      ? undefined
      : replay.successfulCommands[checkpoint.commandIndex];
  const focusedMistake =
    focusedMistakeIndex === null
      ? undefined
      : session.mistakes[focusedMistakeIndex];
  const checkpointElapsedMs =
    replay === null || checkpoint === null || checkpoint.commandIndex === 0
      ? 0
      : (replay.commandElapsedMs?.[checkpoint.commandIndex - 1] ?? 0);
  return (
    <div className={styles.review}>
      <section className={styles.scorecard} aria-label="Session scorecard">
        <div>
          <span>Decision quality</span>
          <strong>{session.decisionQuality}%</strong>
        </div>
        <div>
          <span>Discipline</span>
          <strong>{session.discipline}%</strong>
        </div>
        <div>
          <span>{INTENT_LABELS[session.intent] ?? "Practice intent"}</span>
          <strong>{session.intentScore}%</strong>
        </div>
        <div>
          <span>Hands</span>
          <strong>{session.hands}</strong>
        </div>
        <div className={styles.secondaryMetric}>
          <span>Virtual net</span>
          <strong>{formatCents(net, true)}</strong>
        </div>
      </section>

      <section className={styles.timeline} aria-labelledby="mistakes-heading">
        <div className={sectionStyles.panelHeader}>
          <h2 id="mistakes-heading">Mistake timeline</h2>
          <span>{session.mistakes.length} scored errors</span>
        </div>
        {session.mistakes.length === 0 ? (
          <p className={styles.cleanRun}>
            No scored technical errors in this session.
          </p>
        ) : (
          <ol>
            {session.mistakes.map((mistake, index) => (
              <li key={`${mistake.handNumber}-${mistake.category}-${index}`}>
                <span>Hand {mistake.handNumber}</span>
                <div>
                  <strong>{mistake.situation}</strong>
                  <small>{CATEGORY_LABELS[mistake.category]}</small>
                </div>
                <dl>
                  <div>
                    <dt>Your answer</dt>
                    <dd>{mistake.actual}</dd>
                  </div>
                  <div>
                    <dt>Correct</dt>
                    <dd>{mistake.expected}</dd>
                  </div>
                </dl>
                {session.replay === null ||
                mistake.replayCommandIndex === undefined ? null : (
                  <button
                    onClick={() => {
                      const target = checkpoints.findIndex(
                        (candidate) =>
                          candidate.commandIndex === mistake.replayCommandIndex
                      );
                      setCheckpointSelection({
                        sessionId: session.id,
                        index: target < 0 ? 0 : target
                      });
                      setMistakeSelection({ sessionId: session.id, index });
                      document.getElementById("shoe-replay-heading")?.focus();
                    }}
                    type="button"
                  >
                    Replay point
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.breakdown} aria-labelledby="breakdown-heading">
        <div className={sectionStyles.panelHeader}>
          <h2 id="breakdown-heading">Technical breakdown</h2>
          <span>Local scored evidence</span>
        </div>
        <dl>
          {SKILL_IDS.map((skillId) => {
            const skill = session.skillResults.find(
              (result) => result.id === skillId
            );
            return (
              <div key={skillId}>
                <dt>{CATEGORY_LABELS[skillId]}</dt>
                <dd>
                  {skill === undefined || skill.attempts === 0
                    ? "No attempts"
                    : `${skill.correct}/${skill.attempts} · ${Math.round((skill.correct / skill.attempts) * 100)}%`}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Average decision time</dt>
            <dd>
              {session.replay === null ||
              averageDecisionTime(session.replay) === null
                ? "No attempts"
                : `${Math.round(averageDecisionTime(session.replay)! / 100) / 10}s`}
            </dd>
          </div>
        </dl>
      </section>

      {replay === null || replayView === null || checkpoint === null ? null : (
        <section
          className={styles.replay}
          aria-labelledby="shoe-replay-heading"
        >
          <div className={sectionStyles.panelHeader}>
            <h2 id="shoe-replay-heading" tabIndex={-1}>
              Shoe replay
            </h2>
            <span>Verified hand and decision timeline</span>
          </div>
          <div className={styles.replayNavigation}>
            <button
              disabled={visibleCheckpointIndex === 0}
              onClick={() => {
                setMistakeSelection(null);
                setCheckpointSelection({
                  sessionId: session.id,
                  index: Math.max(0, visibleCheckpointIndex - 1)
                });
              }}
              type="button"
            >
              Previous
            </button>
            <label>
              Review checkpoint
              <select
                onChange={(event) => {
                  setMistakeSelection(null);
                  setCheckpointSelection({
                    sessionId: session.id,
                    index: Number(event.target.value)
                  });
                }}
                value={visibleCheckpointIndex}
              >
                {checkpoints.map((candidate, index) => (
                  <option
                    key={`${candidate.commandIndex}-${candidate.label}`}
                    value={index}
                  >
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={visibleCheckpointIndex === checkpoints.length - 1}
              onClick={() => {
                setMistakeSelection(null);
                setCheckpointSelection({
                  sessionId: session.id,
                  index: Math.min(
                    checkpoints.length - 1,
                    visibleCheckpointIndex + 1
                  )
                });
              }}
              type="button"
            >
              Next
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            Checkpoint: {checkpoint.label}
          </p>

          <div className={styles.tableContext}>
            <section aria-label="Dealer replay cards">
              <span>
                Dealer · upcard {cardLabel(replayView.dealerCards[0] ?? null)}
              </span>
              <div className={styles.cards}>
                {replayView.dealerCards.map((card, index) => (
                  <b key={card?.id ?? `hidden-${index}`}>{cardLabel(card)}</b>
                ))}
              </div>
            </section>
            <section aria-label="Player replay cards">
              <span>
                Player hand {replayView.activeHandIndex + 1} · total{" "}
                {activeHand === null
                  ? "--"
                  : evaluateHand(activeHand.cards).total}
              </span>
              <div className={styles.cards}>
                {activeHand?.cards.map((card) => (
                  <b key={card.id}>{cardLabel(card)}</b>
                )) ?? <b>Not dealt</b>}
              </div>
            </section>
          </div>

          <dl className={styles.decisionContext}>
            <div>
              <dt>Checkpoint</dt>
              <dd>{checkpoint.label}</dd>
            </div>
            <div>
              <dt>Next recorded command</dt>
              <dd>
                {nextCommand === undefined
                  ? "Session complete"
                  : commandLabel(nextCommand)}
              </dd>
            </div>
            <div>
              <dt>Virtual wager</dt>
              <dd>
                {formatCents(
                  activeHand?.wagerCents ??
                    replayView.result?.wagerCents ??
                    replayView.pendingBetCents
                )}
              </dd>
            </div>
            <div>
              <dt>Rules</dt>
              <dd>
                {replayView.rules.decks}D · {replayView.rules.blackjackPayout} ·{" "}
                {replayView.rules.dealerSoft17} ·{" "}
                {replayView.rules.doubleAfterSplit ? "DAS" : "No DAS"}
              </dd>
            </div>
            <div>
              <dt>Index profile</dt>
              <dd>{replayView.deviationProfileId ?? "Basic strategy only"}</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{replayView.result?.message ?? "Decision in progress"}</dd>
            </div>
          </dl>

          {focusedMistake === undefined ? null : (
            <section
              className={styles.scoredDecision}
              aria-label="Scored decision"
            >
              <span>Scored decision · {focusedMistake.situation}</span>
              <dl>
                <div>
                  <dt>Submitted action</dt>
                  <dd>{focusedMistake.actual}</dd>
                </div>
                <div>
                  <dt>Expected action</dt>
                  <dd>{focusedMistake.expected}</dd>
                </div>
              </dl>
            </section>
          )}

          <div className={styles.replayMetrics}>
            <div>
              <span>Phase</span>
              <strong>{replayView.phase}</strong>
            </div>
            <div>
              <span>Running count</span>
              <strong>{replayView.count.runningCount}</strong>
            </div>
            <div>
              <span>True count</span>
              <strong>{replayView.count.trueCountResolved}</strong>
            </div>
            <div>
              <span>Decks remain</span>
              <strong>
                {replayView.count.decksRemainingEstimated.toFixed(1)}
              </strong>
            </div>
            <div>
              <span>Virtual bankroll</span>
              <strong>{formatCents(replayView.bankrollCents)}</strong>
            </div>
            <div>
              <span>Elapsed</span>
              <strong>{Math.round(checkpointElapsedMs / 100) / 10}s</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
