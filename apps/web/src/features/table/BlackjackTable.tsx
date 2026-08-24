"use client";

import {
  DEFAULT_SESSION_CONFIG,
  MAX_REPLAY_COMMANDS,
  MAX_REPLAY_SHOES,
  applyCommand,
  createSession,
  evaluateHand,
  evaluateInsuranceDeviation,
  exportReplay,
  replayTableTimeline,
  selectTableView,
  type PlayerAction,
  type SessionCommand,
  type SessionConfig,
  type SessionState,
  type TerminalReason
} from "@trueedge/game-core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wagerChoices } from "../../lib/betRamp";
import { formatCents } from "../../lib/format";
import { updateSelectedGameId } from "../../lib/gamePreference";
import {
  readBrowserAppData,
  recordSession,
  writeBrowserAppData,
  type StoredMistake,
  type StoredSkillProgress
} from "../../lib/storage";
import { CardHand } from "./CardHand";
import {
  TrainingRail,
  deriveDecisionGuide,
  deriveDeviationProfileId,
  type DecisionGuide,
  type TrainingMode
} from "./TrainingRail";
import styles from "./BlackjackTable.module.css";

export interface BlackjackTableProps {
  readonly seed: number;
  readonly config?: SessionConfig;
  readonly mode?: TrainingMode;
  readonly presetLabel?: string;
  readonly tableMinimumCents?: number;
}

interface TableSession {
  readonly state: SessionState;
  readonly notice: string;
  readonly commandElapsedMs: readonly number[];
  readonly startedAtEpochMs: number;
}

interface StrategyNotice {
  readonly title: "Basic strategy miss" | "Deviation miss" | "Insurance miss";
  readonly message: string;
}

type PlayAction = Extract<
  PlayerAction,
  "hit" | "stand" | "double" | "split" | "surrender"
>;

const TERMINAL_LABELS: Readonly<Record<TerminalReason, string>> = {
  maximum_loss: "Maximum loss reached",
  win_stop: "Win stop reached",
  hand_limit: "Hand limit reached",
  maximum_hands: "Maximum hands reached",
  maximum_duration: "Duration limit reached",
  bankroll_depleted: "Practice bankroll depleted"
};

const MAX_PERSISTED_REPLAY_BYTES = 300_000;

const MODE_POLICIES: Readonly<
  Record<
    TrainingMode,
    {
      readonly scoreDecisions: boolean;
      readonly countPrompts: boolean;
      readonly immediateDecisionFeedback: boolean;
    }
  >
> = {
  play: {
    scoreDecisions: true,
    countPrompts: false,
    immediateDecisionFeedback: false
  },
  observation: {
    scoreDecisions: false,
    countPrompts: false,
    immediateDecisionFeedback: false
  },
  practice: {
    scoreDecisions: true,
    countPrompts: true,
    immediateDecisionFeedback: false
  },
  decision: {
    scoreDecisions: true,
    countPrompts: false,
    immediateDecisionFeedback: true
  }
};

function createSeededSession(
  seed: number,
  config?: SessionConfig
): SessionState {
  return createSession(config ?? { ...DEFAULT_SESSION_CONFIG, seed });
}

function actionNotice(command: SessionCommand, state: SessionState): string {
  const next = selectTableView(state);
  if (next.terminalReason !== null) return TERMINAL_LABELS[next.terminalReason];
  if (next.result !== null) return next.result.message;
  if (command.type === "deal") return "Cards dealt. Make the next decision.";
  if (command.type === "place_bet") {
    return `${formatCents(command.amountCents)} virtual wager selected.`;
  }
  if (command.type === "insurance") return "Insurance recorded.";
  if (command.type === "decline_insurance") return "Insurance declined.";
  if (command.type === "tighten_limits") return "Hard limits tightened.";
  if (command.type.startsWith("submit_")) return "Training answer recorded.";
  return `${command.type[0]!.toUpperCase()}${command.type.slice(1)} accepted.`;
}

function resultLabel(outcome: string | undefined): string | undefined {
  if (outcome === undefined) return undefined;
  return outcome === "blackjack"
    ? "Blackjack"
    : outcome[0]!.toUpperCase() + outcome.slice(1);
}

function accuracy(attempts: number, correct: number): number {
  return attempts === 0 ? 0 : Math.round((correct / attempts) * 100);
}

function scoreIntent(
  intent: SessionConfig["practiceIntent"],
  skills: readonly StoredSkillProgress[],
  discipline: number
): number {
  if (intent === "discipline") return discipline;
  const target = intent === "deviation" ? "deviations" : intent;
  if (target !== undefined && target !== "full_game") {
    const skill = skills.find((item) => item.id === target);
    return skill === undefined ? 0 : accuracy(skill.attempts, skill.correct);
  }
  const attempted = skills.filter((skill) => skill.attempts > 0);
  const technical =
    attempted.length === 0
      ? 0
      : attempted.reduce(
          (sum, skill) => sum + accuracy(skill.attempts, skill.correct),
          0
        ) / attempted.length;
  return Math.round((technical * 4 + discipline) / 5);
}

function effectiveSessionIntent(
  mode: TrainingMode,
  intent: SessionConfig["practiceIntent"],
  deviationProfileId: SessionConfig["deviationProfileId"]
): NonNullable<SessionConfig["practiceIntent"]> {
  const selected = intent ?? "full_game";
  if (mode === "observation") return "discipline";
  if (
    selected === "deviation" &&
    deviationProfileId === "basic-strategy-only"
  ) {
    return "basic_strategy";
  }
  if (
    mode !== "practice" &&
    (selected === "running_count" ||
      selected === "deck_estimation" ||
      selected === "true_count")
  ) {
    return "full_game";
  }
  return selected;
}

export function BlackjackTable({
  seed,
  config,
  mode = "observation",
  presetLabel = "Custom rules",
  tableMinimumCents = 500
}: BlackjackTableProps) {
  const router = useRouter();
  const [session, setSession] = useState<TableSession>(() => ({
    state: createSeededSession(seed, config),
    notice: "Choose a virtual wager to begin.",
    commandElapsedMs: [],
    startedAtEpochMs: Date.now()
  }));
  const [replayVisible, setReplayVisible] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [persistenceError, setPersistenceError] = useState("");
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [strategyNotice, setStrategyNotice] = useState<StrategyNotice | null>(
    null
  );
  const [decisionFeedbackLog, setDecisionFeedbackLog] = useState<
    readonly string[]
  >([]);
  const [lastGuide, setLastGuide] = useState<DecisionGuide | null>(null);
  const [decisionAttempts, setDecisionAttempts] = useState(0);
  const [decisionCorrect, setDecisionCorrect] = useState(0);
  const [basicAttempts, setBasicAttempts] = useState(0);
  const [basicCorrect, setBasicCorrect] = useState(0);
  const [deviationAttempts, setDeviationAttempts] = useState(0);
  const [deviationCorrect, setDeviationCorrect] = useState(0);
  const [insuranceAttempts, setInsuranceAttempts] = useState(0);
  const [insuranceCorrect, setInsuranceCorrect] = useState(0);
  const [mistakes, setMistakes] = useState<readonly StoredMistake[]>([]);
  const [countAnswer, setCountAnswer] = useState("");
  const [deckAnswer, setDeckAnswer] = useState("");
  const [trueCountAnswer, setTrueCountAnswer] = useState("");
  const persistedKey = useRef<string | null>(null);
  const sessionStartedAtMs = useRef<number | null>(null);
  const tableAppRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const insurancePromptRef = useRef<HTMLDivElement>(null);
  const { state, notice, commandElapsedMs } = session;
  const modePolicy = MODE_POLICIES[mode];
  const view = useMemo(() => selectTableView(state), [state]);
  const replayData = useMemo(
    () =>
      replayVisible
        ? commandElapsedMs.length === state.successfulCommands.length
          ? { ...exportReplay(state), commandElapsedMs }
          : exportReplay(state)
        : null,
    [commandElapsedMs, replayVisible, state]
  );
  const replay = useMemo(
    () => (replayData === null ? "" : JSON.stringify(replayData, null, 2)),
    [replayData]
  );
  const visibleReplayStep = Math.min(
    replayStep ?? replayData?.successfulCommands.length ?? 0,
    replayData?.successfulCommands.length ?? 0
  );
  const replayTimeline = useMemo(
    () => (replayData === null ? null : replayTableTimeline(replayData)),
    [replayData]
  );
  const replayPreview = replayTimeline?.[visibleReplayStep]?.view ?? view;
  const betChoices = useMemo(
    () => wagerChoices(tableMinimumCents, view.limits.maxBetCents),
    [tableMinimumCents, view.limits.maxBetCents]
  );
  const repeatWagerCents = state.round?.wagerCents ?? null;
  const canRepeatWager =
    view.phase === "settled" &&
    repeatWagerCents !== null &&
    repeatWagerCents <= view.bankrollCents &&
    repeatWagerCents <= view.limits.maxBetCents;
  const selectedWagerCents =
    view.pendingBetCents > 0
      ? view.pendingBetCents
      : canRepeatWager
        ? repeatWagerCents
        : null;
  const canDealSelectedWager = view.canDeal || canRepeatWager;

  const dispatch = useCallback((command: SessionCommand) => {
    const recordedAtEpochMs = Date.now();
    setSession((current) => {
      const result = applyCommand(current.state, command);
      if (!result.ok) {
        return {
          ...current,
          notice: result.error ?? "That action is not available."
        };
      }
      return {
        state: result.state,
        notice: actionNotice(command, result.state),
        commandElapsedMs: [
          ...current.commandElapsedMs,
          Math.max(
            current.commandElapsedMs.at(-1) ?? 0,
            recordedAtEpochMs - current.startedAtEpochMs
          )
        ],
        startedAtEpochMs: current.startedAtEpochMs
      };
    });
  }, []);

  const startRound = useCallback(() => {
    setLastFeedback(null);
    setLastGuide(null);
    setDecisionFeedbackLog([]);
    setStrategyNotice(null);
    dispatch({ type: "deal" });
  }, [dispatch]);

  const dealSelectedWager = useCallback(() => {
    if (!view.canDeal) {
      if (!canRepeatWager || repeatWagerCents === null) return;
      dispatch({ type: "place_bet", amountCents: repeatWagerCents });
    }
    startRound();
  }, [canRepeatWager, dispatch, repeatWagerCents, startRound, view.canDeal]);

  useEffect(() => {
    tableAppRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    if (state.config.presetId !== undefined) {
      updateSelectedGameId(state.config.presetId);
    }
  }, [state.config.presetId]);

  useEffect(() => {
    if (view.phase === "settled") controlsRef.current?.focus();
  }, [view.phase]);

  useEffect(() => {
    if (view.phase !== "insurance") return;
    const prompt = insurancePromptRef.current;
    prompt?.scrollIntoView?.({ block: "center" });
    prompt?.focus({ preventScroll: true });
  }, [view.phase]);

  const performAction = useCallback(
    (action: PlayAction) => {
      const guide = deriveDecisionGuide(view);
      if (guide !== null) {
        setLastGuide(guide);
        const correct = action === guide.action;
        const feedback = correct
          ? `Correct: ${action}. ${guide.explanation}`
          : `You chose ${action}. The model calls for ${guide.action}. ${guide.explanation}`;
        setLastFeedback(feedback);
        setStrategyNotice(
          correct
            ? null
            : {
                title: guide.deviation
                  ? "Deviation miss"
                  : "Basic strategy miss",
                message: `You chose ${action}. Expected ${guide.action}. ${guide.explanation}`
              }
        );
        if (modePolicy.immediateDecisionFeedback) {
          setDecisionFeedbackLog((current) => [...current, feedback].slice(-8));
        }
        if (modePolicy.scoreDecisions) {
          setDecisionAttempts((value) => value + 1);
          if (correct) setDecisionCorrect((value) => value + 1);
          if (guide.deviation) {
            setDeviationAttempts((value) => value + 1);
            if (correct) setDeviationCorrect((value) => value + 1);
          } else {
            setBasicAttempts((value) => value + 1);
            if (correct) setBasicCorrect((value) => value + 1);
          }
        }
        if (modePolicy.scoreDecisions && !correct) {
          setMistakes((current) => [
            ...current.slice(-249),
            {
              handNumber: state.analytics.handsPlayed + 1,
              situation: `${view.playerHand?.total ?? "Hand"} against ${view.dealerCards[0]?.rank ?? "dealer"}`,
              actual: action,
              expected: guide.action,
              category: guide.deviation ? "deviations" : "basic_strategy",
              replayCommandIndex: state.successfulCommands.length
            }
          ]);
        }
      }
      dispatch({ type: action });
    },
    [
      dispatch,
      modePolicy,
      state.analytics.handsPlayed,
      state.successfulCommands.length,
      view
    ]
  );

  const performInsurance = useCallback(
    (takeInsurance: boolean) => {
      const profile = deriveDeviationProfileId(view);
      const decision =
        profile === "basic-strategy-only"
          ? {
              action: "decline" as const,
              explanation:
                "No compatible count-based insurance profile is selected, so decline insurance."
            }
          : evaluateInsuranceDeviation({
              profile,
              rules: view.rules,
              trueCount: view.count.trueCountResolved
            });
      const actual = takeInsurance ? "insurance" : "decline";
      const correct = actual === decision.action;
      const feedback = correct
        ? `Correct: ${actual}. ${decision.explanation}`
        : `You chose ${actual}. The model calls for ${decision.action}. ${decision.explanation}`;
      setLastFeedback(feedback);
      setStrategyNotice(
        correct
          ? null
          : {
              title: "Insurance miss",
              message: `You chose ${actual}. Expected ${decision.action}. ${decision.explanation}`
            }
      );
      if (modePolicy.immediateDecisionFeedback) {
        setDecisionFeedbackLog((current) => [...current, feedback].slice(-8));
      }
      if (modePolicy.scoreDecisions) {
        setDecisionAttempts((value) => value + 1);
        setInsuranceAttempts((value) => value + 1);
        if (correct) {
          setDecisionCorrect((value) => value + 1);
          setInsuranceCorrect((value) => value + 1);
        }
      }
      if (modePolicy.scoreDecisions && !correct) {
        setMistakes((current) => [
          ...current.slice(-249),
          {
            handNumber: state.analytics.handsPlayed + 1,
            situation: `Insurance at TC ${view.count.trueCountResolved}`,
            actual,
            expected: decision.action,
            category: "insurance",
            replayCommandIndex: state.successfulCommands.length
          }
        ]);
      }
      dispatch({ type: takeInsurance ? "insurance" : "decline_insurance" });
    },
    [
      dispatch,
      modePolicy,
      state.analytics.handsPlayed,
      state.successfulCommands.length,
      view
    ]
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || !event.altKey || event.repeat)
        return;
      if (
        controlsRef.current === null ||
        !(event.target instanceof Node) ||
        !controlsRef.current.contains(event.target)
      ) {
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      let handled = true;
      if (key === "d" && canDealSelectedWager) dealSelectedWager();
      else if (key === "h" && view.canHit) performAction("hit");
      else if (key === "s" && view.canStand) performAction("stand");
      else if (key === "x" && view.canDouble) performAction("double");
      else if (key === "p" && view.canSplit) performAction("split");
      else if (key === "r" && view.canSurrender) performAction("surrender");
      else handled = false;
      if (handled) {
        event.preventDefault();
        controlsRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canDealSelectedWager, dealSelectedWager, performAction, view]);

  useEffect(() => {
    const duration = state.config.limits.maxDurationSeconds;
    if (view.phase === "stopped" || duration === undefined) return;
    if (state.elapsedSeconds >= duration) return;
    if (sessionStartedAtMs.current === null) {
      sessionStartedAtMs.current = performance.now();
    }
    const elapsedWallMs = performance.now() - sessionStartedAtMs.current;
    const remainingMs = Math.max(
      0,
      duration * 1_000 - Math.max(elapsedWallMs, state.elapsedSeconds * 1_000)
    );
    const timer = window.setTimeout(() => {
      dispatch({
        type: "advance_time",
        seconds: duration - state.elapsedSeconds
      });
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    state.config.limits.maxDurationSeconds,
    state.elapsedSeconds,
    view.phase
  ]);

  const persistSession = useCallback(
    (completionReason: string, key: string): boolean => {
      if (typeof window === "undefined") return false;
      if (persistedKey.current === key) return true;
      if (commandElapsedMs.length !== state.successfulCommands.length) {
        queueMicrotask(() => {
          setPersistenceError(
            "Finish the current action before ending the session."
          );
        });
        return false;
      }
      const decisionQuality =
        decisionAttempts === 0
          ? 0
          : Math.round((decisionCorrect / decisionAttempts) * 100);
      const discipline = Math.max(
        0,
        100 - view.analytics.disciplineViolations * 20
      );
      const sessionIntent = effectiveSessionIntent(
        mode,
        state.config.practiceIntent,
        deriveDeviationProfileId(view)
      );
      const scoreTechnicalSkills = modePolicy.scoreDecisions;
      const skillResults: readonly StoredSkillProgress[] = [
        {
          id: "basic_strategy",
          attempts: scoreTechnicalSkills ? basicAttempts : 0,
          correct: scoreTechnicalSkills ? basicCorrect : 0
        },
        {
          id: "deviations",
          attempts: scoreTechnicalSkills ? deviationAttempts : 0,
          correct: scoreTechnicalSkills ? deviationCorrect : 0
        },
        {
          id: "insurance",
          attempts: scoreTechnicalSkills ? insuranceAttempts : 0,
          correct: scoreTechnicalSkills ? insuranceCorrect : 0
        },
        {
          id: "running_count",
          attempts: scoreTechnicalSkills ? view.analytics.countAttempts : 0,
          correct: scoreTechnicalSkills ? view.analytics.countCorrect : 0
        },
        {
          id: "deck_estimation",
          attempts: scoreTechnicalSkills ? view.analytics.deckAttempts : 0,
          correct: scoreTechnicalSkills ? view.analytics.deckCorrect : 0
        },
        {
          id: "true_count",
          attempts: scoreTechnicalSkills ? view.analytics.trueCountAttempts : 0,
          correct: scoreTechnicalSkills ? view.analytics.trueCountCorrect : 0
        }
      ];
      const current = readBrowserAppData();
      const completedAt = new Date().toISOString();
      const sessionId = `session-${seed}-${completedAt}-${window.crypto.randomUUID()}`;
      const exportedReplay = exportReplay(state);
      const replayCandidate =
        exportedReplay.successfulCommands.length <= MAX_REPLAY_COMMANDS &&
        exportedReplay.resolvedShoes.length <= MAX_REPLAY_SHOES
          ? { ...exportedReplay, commandElapsedMs }
          : null;
      const persistedReplay =
        replayCandidate !== null &&
        JSON.stringify(replayCandidate).length <= MAX_PERSISTED_REPLAY_BYTES
          ? replayCandidate
          : null;
      const next = recordSession(
        current,
        {
          id: sessionId,
          completedAt,
          presetId: state.config.presetId ?? "custom",
          hands: view.analytics.handsPlayed,
          startingBankrollCents: state.config.limits.startingBankrollCents,
          endingBankrollCents: view.bankrollCents,
          decisionQuality,
          discipline,
          intent: sessionIntent,
          intentScore: scoreIntent(sessionIntent, skillResults, discipline),
          skillResults,
          completionReason,
          mistakes,
          replay: persistedReplay
        },
        skillResults
      );
      if (writeBrowserAppData(next)) {
        persistedKey.current = key;
        return true;
      } else {
        queueMicrotask(() => {
          setPersistenceError(
            "Session finished, but browser progress could not be saved."
          );
        });
        return false;
      }
    },
    [
      basicAttempts,
      basicCorrect,
      commandElapsedMs,
      decisionAttempts,
      decisionCorrect,
      deviationAttempts,
      deviationCorrect,
      insuranceAttempts,
      insuranceCorrect,
      mistakes,
      mode,
      modePolicy.scoreDecisions,
      seed,
      state,
      view
    ]
  );

  useEffect(() => {
    if (view.terminalReason === null) return;
    const key = `${seed}:${view.analytics.handsPlayed}:${view.terminalReason}`;
    persistSession(TERMINAL_LABELS[view.terminalReason], key);
  }, [persistSession, seed, view.analytics.handsPlayed, view.terminalReason]);

  const endSessionAndReview = useCallback(() => {
    setEndingSession(true);
    setPersistenceError("");
    const terminalReason = view.terminalReason;
    const completionReason =
      terminalReason === null
        ? "Ended by player"
        : TERMINAL_LABELS[terminalReason];
    const key = `${seed}:${view.analytics.handsPlayed}:${terminalReason ?? "manual_end"}`;
    if (persistSession(completionReason, key)) {
      router.push("/review");
    } else {
      setEndingSession(false);
    }
  }, [
    persistSession,
    router,
    seed,
    view.analytics.handsPlayed,
    view.terminalReason
  ]);

  const submitTraining = useCallback(
    (
      type: "submit_count" | "submit_deck_estimate" | "submit_true_count",
      raw: string,
      clear: () => void
    ) => {
      if (raw.trim() === "") {
        setSession((current) => ({
          ...current,
          notice: "Enter an answer before checking it."
        }));
        return;
      }
      const value = Number(raw);
      if (
        !Number.isFinite(value) ||
        ((type === "submit_count" || type === "submit_true_count") &&
          !Number.isInteger(value)) ||
        (type === "submit_deck_estimate" && value < 0)
      ) {
        setSession((current) => ({
          ...current,
          notice:
            type === "submit_deck_estimate"
              ? "Enter a non-negative numeric estimate first."
              : "Enter a whole-number count first."
        }));
        return;
      }
      const expected =
        type === "submit_count"
          ? view.count.runningCount
          : type === "submit_deck_estimate"
            ? view.count.decksRemainingEstimated
            : view.count.trueCountResolved;
      const result = applyCommand(state, { type, value });
      if (!result.ok) {
        setSession((current) => ({
          ...current,
          notice: result.error ?? "That answer could not be recorded."
        }));
        return;
      }
      const error = value - expected;
      const correct =
        type === "submit_deck_estimate" ? Math.abs(error) <= 0.25 : error === 0;
      if (!correct) {
        const category =
          type === "submit_count"
            ? "running_count"
            : type === "submit_deck_estimate"
              ? "deck_estimation"
              : "true_count";
        setMistakes((current) => [
          ...current.slice(-249),
          {
            handNumber: state.analytics.handsPlayed + 1,
            situation:
              type === "submit_count"
                ? "Running count check"
                : type === "submit_deck_estimate"
                  ? "Deck estimate check"
                  : "True count check",
            actual: String(value),
            expected: String(expected),
            category,
            replayCommandIndex: state.successfulCommands.length
          }
        ]);
      }
      setSession({
        state: result.state,
        notice: `Submitted ${value}. Actual ${expected}. Signed error ${error > 0 ? "+" : ""}${error}.`,
        commandElapsedMs: [
          ...session.commandElapsedMs,
          Math.max(
            session.commandElapsedMs.at(-1) ?? 0,
            Date.now() - session.startedAtEpochMs
          )
        ],
        startedAtEpochMs: session.startedAtEpochMs
      });
      clear();
    },
    [session, state, view.count]
  );

  const resultTone =
    view.result !== null && view.result.profitCents < 0
      ? styles.negative
      : styles.positive;
  const practicePrompts =
    modePolicy.countPrompts &&
    view.count.cardsSeen > 0 &&
    view.phase !== "stopped";

  return (
    <div
      className={styles.tableApp}
      data-testid="trueedge-table"
      ref={tableAppRef}
    >
      <section className={styles.sessionBar} aria-label="Session status">
        <div className={styles.primaryMetric}>
          <span>Practice bankroll</span>
          <strong>{formatCents(view.bankrollCents)}</strong>
        </div>
        <div>
          <span>Game</span>
          <strong>{presetLabel}</strong>
        </div>
        <div>
          <span>Rules</span>
          <strong>
            {view.rules.decks}D · {view.rules.blackjackPayout} ·{" "}
            {view.rules.dealerSoft17}
          </strong>
        </div>
        <div>
          <span>Hard stop</span>
          <strong>{formatCents(view.limits.maxLossCents)} loss</strong>
        </div>
        <div>
          <span>Seed</span>
          <code>{seed}</code>
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.tableColumn} aria-label="Blackjack table">
          <div className={styles.felt}>
            <div className={styles.tableRules}>
              <span>
                {view.rules.doubleAfterSplit ? "DAS" : "No DAS"} ·{" "}
                {view.rules.surrender === "none"
                  ? "No surrender"
                  : `${view.rules.surrender} surrender`}
              </span>
              <strong>
                {view.shoe.shuffleMode === "continuous"
                  ? "CSM pool"
                  : `${Math.round(view.shoe.penetration * 100)}% cut`}
              </strong>
            </div>

            <CardHand
              cards={view.dealerCards}
              label="Dealer"
              owner="dealer"
              total={view.dealerHand?.total ?? null}
            />

            {view.canInsure || view.canDeclineInsurance ? (
              <div
                aria-label="Insurance decision"
                className={styles.insurancePrompt}
                ref={insurancePromptRef}
                role="group"
                tabIndex={-1}
              >
                <span>Dealer shows an ace</span>
                <button
                  disabled={!view.canInsure}
                  onClick={() => performInsurance(true)}
                  type="button"
                >
                  Take insurance
                </button>
                <button
                  disabled={!view.canDeclineInsurance}
                  onClick={() => performInsurance(false)}
                  type="button"
                >
                  Decline
                </button>
              </div>
            ) : (
              <div className={styles.wagerMarker}>
                <span>Wager</span>
                <strong>
                  {selectedWagerCents === null
                    ? "No bet"
                    : formatCents(selectedWagerCents)}
                </strong>
              </div>
            )}

            <div className={styles.playerHands}>
              {view.playerHands.length === 0 ? (
                <CardHand
                  cards={[]}
                  label="Your hand"
                  owner="player"
                  total={null}
                />
              ) : (
                view.playerHands.map((hand, index) => (
                  <CardHand
                    active={
                      index === view.activeHandIndex && view.phase === "player"
                    }
                    cards={hand.cards}
                    key={hand.id}
                    label={
                      view.playerHands.length === 1
                        ? "Your hand"
                        : `Hand ${index + 1}`
                    }
                    owner="player"
                    {...(hand.result === null
                      ? {}
                      : { result: resultLabel(hand.result.outcome)! })}
                    total={evaluateHand(hand.cards).total}
                  />
                ))
              )}
            </div>
          </div>

          <section
            className={styles.controls}
            aria-label="Table controls"
            ref={controlsRef}
            tabIndex={-1}
          >
            <div
              aria-atomic="true"
              aria-live="polite"
              className={styles.notice}
            >
              <span>
                {view.result === null ? "Table status" : "Round complete"}
              </span>
              <strong>{notice}</strong>
              {view.result === null ? null : (
                <b className={resultTone}>
                  {formatCents(view.result.profitCents, true)}
                </b>
              )}
            </div>

            <div className={styles.actionStack}>
              <div
                aria-label="Virtual wager choices"
                className={styles.betActions}
                role="group"
              >
                {betChoices.map((amount) => (
                  <button
                    aria-pressed={selectedWagerCents === amount}
                    disabled={
                      !view.canPlaceBet ||
                      amount > view.bankrollCents ||
                      amount > view.limits.maxBetCents
                    }
                    key={amount}
                    onClick={() =>
                      dispatch({ type: "place_bet", amountCents: amount })
                    }
                    type="button"
                  >
                    Bet {formatCents(amount)}
                  </button>
                ))}
              </div>
              <div
                aria-label="Play actions"
                className={styles.playActions}
                role="group"
              >
                <button
                  aria-label="Deal"
                  className={styles.dealButton}
                  disabled={!canDealSelectedWager}
                  onClick={() => {
                    controlsRef.current?.focus();
                    dealSelectedWager();
                  }}
                  type="button"
                >
                  Deal <kbd>⌥D</kbd>
                </button>
                <button
                  aria-label="Hit"
                  disabled={!view.canHit}
                  onClick={() => performAction("hit")}
                  type="button"
                >
                  Hit <kbd>⌥H</kbd>
                </button>
                <button
                  aria-label="Stand"
                  disabled={!view.canStand}
                  onClick={() => performAction("stand")}
                  type="button"
                >
                  Stand <kbd>⌥S</kbd>
                </button>
                <button
                  aria-label="Double"
                  disabled={!view.canDouble}
                  onClick={() => performAction("double")}
                  type="button"
                >
                  Double <kbd>⌥X</kbd>
                </button>
                <button
                  aria-label="Split"
                  disabled={!view.canSplit}
                  onClick={() => performAction("split")}
                  type="button"
                >
                  Split <kbd>⌥P</kbd>
                </button>
                <button
                  aria-label="Surrender"
                  disabled={!view.canSurrender}
                  onClick={() => performAction("surrender")}
                  type="button"
                >
                  Surrender <kbd>⌥R</kbd>
                </button>
              </div>
            </div>

            {strategyNotice === null ? null : (
              <section
                aria-atomic="true"
                aria-live="polite"
                className={styles.strategyNotice}
                role="status"
              >
                <strong>{strategyNotice.title}</strong>
                <p>{strategyNotice.message}</p>
              </section>
            )}
          </section>
        </section>

        <TrainingRail
          decisionFeedbackLog={decisionFeedbackLog}
          currentPresetId={state.config.presetId ?? ""}
          lastFeedback={lastFeedback}
          mode={mode}
          selectedWagerCents={selectedWagerCents}
          settledGuide={lastGuide}
          tableMinimumCents={tableMinimumCents}
          view={view}
        />
      </div>

      {practicePrompts ? (
        <section className={styles.practicePanel} aria-label="Count practice">
          {[
            [
              "Running count",
              countAnswer,
              setCountAnswer,
              "submit_count",
              view.trainingAvailable.runningCount
            ],
            [
              "Decks remain",
              deckAnswer,
              setDeckAnswer,
              "submit_deck_estimate",
              view.trainingAvailable.deckEstimation
            ],
            [
              "True count",
              trueCountAnswer,
              setTrueCountAnswer,
              "submit_true_count",
              view.trainingAvailable.trueCount
            ]
          ].map(([label, value, setter, type, available]) => (
            <form
              key={String(type)}
              onSubmit={(event) => {
                event.preventDefault();
                submitTraining(
                  type as
                    | "submit_count"
                    | "submit_deck_estimate"
                    | "submit_true_count",
                  value as string,
                  () => (setter as (next: string) => void)("")
                );
              }}
            >
              <label>
                <span>{String(label)}</span>
                <input
                  disabled={!available}
                  inputMode="decimal"
                  onChange={(event) =>
                    (setter as (next: string) => void)(event.target.value)
                  }
                  value={String(value)}
                />
              </label>
              <button disabled={!available} type="submit">
                {available ? "Check" : "Checked"}
              </button>
            </form>
          ))}
        </section>
      ) : null}

      <section className={styles.sessionTools} aria-label="Session tools">
        <details>
          <summary>Tighten hard limits</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const maxBet = Number(form.get("maxBet"));
              const maxLoss = Number(form.get("maxLoss"));
              const winStop = Number(form.get("winStop"));
              dispatch({
                type: "tighten_limits",
                limits: {
                  ...(maxBet > 0
                    ? { maxBetCents: Math.round(maxBet * 100) }
                    : {}),
                  ...(maxLoss > 0
                    ? { maxLossCents: Math.round(maxLoss * 100) }
                    : {}),
                  ...(winStop > 0
                    ? { winStopCents: Math.round(winStop * 100) }
                    : {})
                }
              });
            }}
          >
            <label>
              Max bet, dollars
              <input
                max={view.limits.maxBetCents / 100}
                min="1"
                name="maxBet"
                type="number"
              />
            </label>
            <label>
              Max loss, dollars
              <input
                max={view.limits.maxLossCents / 100}
                min="1"
                name="maxLoss"
                type="number"
              />
            </label>
            <label>
              Win stop, dollars
              <input
                max={view.limits.winStopCents / 100}
                min="1"
                name="winStop"
                type="number"
              />
            </label>
            <button type="submit">Apply tighter limits</button>
          </form>
        </details>
        <button
          aria-controls="trueedge-replay-data"
          aria-expanded={replayVisible}
          onClick={() => setReplayVisible((visible) => !visible)}
          type="button"
        >
          {replayVisible ? "Hide replay" : "Export replay"}
        </button>
        <textarea
          aria-label="Exported replay data"
          hidden={!replayVisible}
          id="trueedge-replay-data"
          readOnly
          rows={9}
          value={replay}
        />
        {replayData === null ? null : (
          <div className={styles.replayScrubber}>
            <label>
              Replay position {visibleReplayStep} of{" "}
              {replayData.successfulCommands.length}
              <input
                max={replayData.successfulCommands.length}
                min="0"
                onChange={(event) => setReplayStep(Number(event.target.value))}
                type="range"
                value={visibleReplayStep}
              />
            </label>
            <p>
              {visibleReplayStep === 0
                ? "Initial shoe"
                : replayData.successfulCommands[
                    visibleReplayStep - 1
                  ]?.type.replaceAll("_", " ")}{" "}
              · {replayPreview.phase} ·{" "}
              {formatCents(replayPreview.bankrollCents)}
            </p>
          </div>
        )}
      </section>

      <section className={styles.endSessionBar} aria-label="Session completion">
        <button
          disabled={endingSession}
          onClick={endSessionAndReview}
          type="button"
        >
          {endingSession
            ? "Saving session"
            : view.terminalReason === null
              ? "End session and review"
              : "Review session"}
        </button>
      </section>

      <footer className={styles.disclaimer}>
        <strong>Training software</strong>
        <span>
          Virtual funds only. No accounts, deposits, or real-money play.
        </span>
        {persistenceError === "" ? null : (
          <span role="status">{persistenceError}</span>
        )}
      </footer>
    </div>
  );
}
