"use client";

import {
  DEFAULT_GAME_RULES,
  calculateTrueCount,
  evaluateInsuranceDeviation,
  generateCountingDrill,
  generateDecisionScenario,
  type PlayerAction
} from "@trueedge/game-core";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  readBrowserAppData,
  recordSkillAttempt,
  writeBrowserAppData,
  type StoredSkillId
} from "../../lib/storage";
import styles from "./DrillRunner.module.css";

const ACTIONS: readonly PlayerAction[] = [
  "hit",
  "stand",
  "double",
  "split",
  "surrender"
];

const SKILL_BY_KIND: Readonly<Record<string, StoredSkillId>> = {
  "running-count": "running_count",
  "deck-estimation": "deck_estimation",
  "true-count": "true_count",
  "basic-strategy": "basic_strategy",
  deviations: "deviations",
  insurance: "insurance",
  penetration: "deck_estimation",
  "full-load": "true_count"
};

interface NumericScenario {
  readonly type: "numeric";
  readonly prompt: string;
  readonly context: string;
  readonly answer: number;
  readonly tolerance: number;
  readonly cards?: readonly string[];
}

interface ActionScenario {
  readonly type: "action";
  readonly prompt: string;
  readonly context: string;
  readonly answer: PlayerAction | "decline";
  readonly choices: readonly (PlayerAction | "decline")[];
  readonly explanation: string;
}

interface FullLoadScenario {
  readonly type: "full-load";
  readonly prompt: string;
  readonly context: string;
  readonly cards: readonly string[];
  readonly runningCount: number;
  readonly decksRemaining: number;
  readonly trueCount: number;
  readonly betUnits: number;
  readonly action: PlayerAction;
  readonly actionSkill: "basic_strategy" | "deviations";
  readonly explanation: string;
}

interface FullLoadAnswers {
  readonly runningCount: string;
  readonly decksRemaining: string;
  readonly trueCount: string;
  readonly betUnits: string;
  readonly action: string;
}

type Scenario = NumericScenario | ActionScenario | FullLoadScenario;

const EMPTY_FULL_ANSWERS: FullLoadAnswers = {
  runningCount: "",
  decksRemaining: "",
  trueCount: "",
  betUnits: "",
  action: ""
};

const FULL_LOAD_FIELDS: readonly {
  readonly label: string;
  readonly field: Exclude<keyof FullLoadAnswers, "action">;
}[] = [
  { label: "Final RC", field: "runningCount" },
  { label: "Decks remain", field: "decksRemaining" },
  { label: "True count", field: "trueCount" },
  { label: "Bet units", field: "betUnits" }
];

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function betUnitsFor(trueCount: number): number {
  if (trueCount <= 0) return 1;
  if (trueCount === 1) return 2;
  if (trueCount === 2) return 4;
  if (trueCount === 3) return 6;
  return 8;
}

function actionForScenario(
  scenario: ReturnType<typeof generateDecisionScenario>
) {
  const indexed =
    scenario.deviationDecision.opportunity &&
    scenario.deviationDecision.eligible;
  return {
    action: indexed
      ? scenario.deviationDecision.action
      : scenario.basicDecision.action,
    indexed,
    explanation: indexed
      ? scenario.deviationDecision.explanation
      : scenario.basicDecision.explanation
  };
}

function buildScenario(kind: string, seed: number): Scenario {
  if (kind === "running-count") {
    const drill = generateCountingDrill({ seed, length: 12 });
    return {
      type: "numeric",
      prompt: "What is the final Hi-Lo running count?",
      context: "Start at zero. Read every exposed card from left to right.",
      answer: drill.finalRunningCount,
      tolerance: 0,
      cards: drill.cards.map(
        (card) => `${card.rank}${card.suit[0]!.toUpperCase()}`
      )
    };
  }

  const cardsRemaining = 62 + ((seed * 37) % 221);
  if (kind === "deck-estimation") {
    const answer = calculateTrueCount({
      runningCount: 0,
      cardsRemaining,
      estimation: "half"
    }).decksRemainingEstimated;
    return {
      type: "numeric",
      prompt: "Estimate the decks remaining to the nearest half deck.",
      context: `${cardsRemaining} cards remain in the shoe.`,
      answer,
      tolerance: 0
    };
  }

  if (kind === "true-count") {
    const runningCount = (seed % 19) - 8;
    const projection = calculateTrueCount({
      runningCount,
      cardsRemaining,
      estimation: "half",
      resolution: "truncate"
    });
    return {
      type: "numeric",
      prompt: "Convert to the truncated true count.",
      context: `RC ${signed(runningCount)} with ${projection.decksRemainingEstimated.toFixed(1)} decks remaining.`,
      answer: projection.trueCountResolved,
      tolerance: 0
    };
  }

  if (kind === "penetration") {
    const decks = 6;
    const cutCards = 52 + (seed % 91);
    const penetration = Math.round((1 - cutCards / (decks * 52)) * 100);
    return {
      type: "numeric",
      prompt: "What percentage of the shoe is dealt before the cut card?",
      context: `${decks} decks with ${cutCards} cards cut off. Round to the nearest percent.`,
      answer: penetration,
      tolerance: 0
    };
  }

  if (kind === "insurance") {
    const trueCount = (seed % 8) - 2;
    const decision = evaluateInsuranceDeviation({
      profile: "hi-lo-shoe-h17",
      rules: DEFAULT_GAME_RULES,
      trueCount
    });
    return {
      type: "action",
      prompt: "Dealer shows an ace. Take insurance or decline?",
      context: `Six-deck H17 Hi-Lo profile at TC ${signed(trueCount)}.`,
      answer: decision.action,
      choices: ["insurance", "decline"],
      explanation: decision.explanation
    };
  }

  if (kind === "full-load") {
    const decisionScenario = generateDecisionScenario({
      seed,
      rules: DEFAULT_GAME_RULES,
      profile: "hi-lo-shoe-h17",
      focus: "mixed"
    });
    const decision = actionForScenario(decisionScenario);
    const decksRemaining = 2 + (seed % 3);
    const runningCount = decisionScenario.trueCount * decksRemaining;
    const baseRun = generateCountingDrill({ seed, length: 10 });
    const startingCount = runningCount - baseRun.finalRunningCount;
    const run = generateCountingDrill({ seed, length: 10, startingCount });
    return {
      type: "full-load",
      prompt: decisionScenario.prompt,
      context: `Start at RC ${signed(startingCount)}. After this exposed-card run, the shoe marker reads ${decksRemaining.toFixed(1)} decks remaining. Use the 1–2–4–6–8 unit ramp for TC 0 or lower through TC +4 or higher.`,
      cards: run.cards.map(
        (card) => `${card.rank}${card.suit[0]!.toUpperCase()}`
      ),
      runningCount,
      decksRemaining,
      trueCount: decisionScenario.trueCount,
      betUnits: betUnitsFor(decisionScenario.trueCount),
      action: decision.action,
      actionSkill: decision.indexed ? "deviations" : "basic_strategy",
      explanation: decision.explanation
    };
  }

  const focus =
    kind === "basic-strategy"
      ? "basic_strategy"
      : kind === "deviations"
        ? "deviations"
        : "mixed";
  const scenario = generateDecisionScenario({
    seed,
    rules: DEFAULT_GAME_RULES,
    profile: "hi-lo-shoe-h17",
    focus
  });
  const decision = actionForScenario(scenario);
  return {
    type: "action",
    prompt: scenario.prompt,
    context: decision.indexed
      ? `Index opportunity at TC ${signed(scenario.trueCount)}.`
      : "Use the displayed six-deck H17 rules.",
    answer: decision.action,
    choices: ACTIONS,
    explanation: decision.explanation
  };
}

export function DrillRunner({ kind }: { readonly kind: string }) {
  const [seed, setSeed] = useState(12_041);
  const [answer, setAnswer] = useState("");
  const [fullAnswers, setFullAnswers] =
    useState<FullLoadAnswers>(EMPTY_FULL_ANSWERS);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [result, setResult] = useState<{
    readonly correct: boolean;
    readonly message: string;
  } | null>(null);
  const [validationError, setValidationError] = useState("");
  const [score, setScore] = useState({ attempts: 0, correct: 0 });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterNext = useRef(false);
  const scenario = useMemo(() => buildScenario(kind, seed), [kind, seed]);
  const skill = SKILL_BY_KIND[kind] ?? "basic_strategy";

  useEffect(() => {
    if (!focusAfterNext.current) return;
    focusAfterNext.current = false;
    headingRef.current?.focus();
  }, [seed]);

  function attemptId(prefix: string): string {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  function submit(candidate: string, decisionTimeMs: number) {
    if (result !== null || scenario.type === "full-load") return;
    if (scenario.type === "numeric" && candidate.trim() === "") {
      setValidationError("Enter a numeric answer before checking it.");
      return;
    }
    setValidationError("");
    const correct =
      scenario.type === "numeric"
        ? Number.isFinite(Number(candidate)) &&
          Math.abs(Number(candidate) - scenario.answer) <= scenario.tolerance
        : candidate === scenario.answer;
    const explanation =
      scenario.type === "action"
        ? scenario.explanation
        : `Answer: ${scenario.answer}.`;
    setAnswer(candidate);
    const message = correct
      ? `Correct. ${explanation}`
      : `Not this time. ${explanation}`;
    setScore((current) => ({
      attempts: current.attempts + 1,
      correct: current.correct + (correct ? 1 : 0)
    }));
    const current = readBrowserAppData();
    const saved = writeBrowserAppData(
      recordSkillAttempt(current, skill, correct, {
        id: attemptId(`drill-${kind}-${seed}`),
        completedAt: new Date().toISOString(),
        skill,
        prompt: `${scenario.context} ${scenario.prompt}`,
        submitted: candidate,
        expected: String(scenario.answer),
        correct,
        errorClass: skill,
        decisionTimeMs,
        algorithmVersion:
          skill === "insurance"
            ? "insurance-index-v1"
            : skill === "deviations"
              ? "hi-lo-deviations-v1"
              : scenario.type === "action"
                ? "basic-strategy-v1"
                : "training-v1",
        profileVersion: scenario.type === "action" ? "hi-lo-shoe-h17" : "hi-lo"
      })
    );
    setResult({
      correct,
      message: saved ? message : `${message} Progress could not be saved.`
    });
  }

  function submitFullLoad(decisionTimeMs: number) {
    if (result !== null || scenario.type !== "full-load") return;
    if (
      fullAnswers.runningCount.trim() === "" ||
      fullAnswers.decksRemaining.trim() === "" ||
      fullAnswers.trueCount.trim() === "" ||
      fullAnswers.betUnits.trim() === "" ||
      fullAnswers.action === ""
    ) {
      setValidationError("Complete all five answers before scoring the chain.");
      return;
    }
    setValidationError("");
    const checks = [
      {
        skill: "running_count" as const,
        submitted: fullAnswers.runningCount,
        expected: String(scenario.runningCount),
        correct: Number(fullAnswers.runningCount) === scenario.runningCount
      },
      {
        skill: "deck_estimation" as const,
        submitted: fullAnswers.decksRemaining,
        expected: scenario.decksRemaining.toFixed(1),
        correct:
          Math.abs(
            Number(fullAnswers.decksRemaining) - scenario.decksRemaining
          ) <= 0.25
      },
      {
        skill: "true_count" as const,
        submitted: fullAnswers.trueCount,
        expected: String(scenario.trueCount),
        correct: Number(fullAnswers.trueCount) === scenario.trueCount
      },
      {
        skill: scenario.actionSkill,
        submitted: fullAnswers.action,
        expected: scenario.action,
        correct: fullAnswers.action === scenario.action
      }
    ];
    const betCorrect = Number(fullAnswers.betUnits) === scenario.betUnits;
    const correct = checks.every((check) => check.correct) && betCorrect;
    const correctParts =
      checks.filter((check) => check.correct).length + (betCorrect ? 1 : 0);
    const message = `${correctParts}/5 steps correct. RC ${signed(scenario.runningCount)}, ${scenario.decksRemaining.toFixed(1)} decks, TC ${signed(scenario.trueCount)}, ${scenario.betUnits} unit${scenario.betUnits === 1 ? "" : "s"}, ${scenario.action}. ${scenario.explanation}`;
    setScore((current) => ({
      attempts: current.attempts + 1,
      correct: current.correct + (correct ? 1 : 0)
    }));
    let nextData = readBrowserAppData();
    for (const check of checks) {
      nextData = recordSkillAttempt(nextData, check.skill, check.correct, {
        id: attemptId(`drill-full-load-${seed}-${check.skill}`),
        completedAt: new Date().toISOString(),
        skill: check.skill,
        prompt: `${scenario.context} ${scenario.prompt}`,
        submitted: check.submitted,
        expected: check.expected,
        correct: check.correct,
        errorClass: check.skill,
        decisionTimeMs,
        algorithmVersion:
          check.skill === "deviations"
            ? "hi-lo-deviations-v1"
            : check.skill === "basic_strategy"
              ? "basic-strategy-v1"
              : "training-v1",
        profileVersion:
          check.skill === "basic_strategy" || check.skill === "deviations"
            ? "hi-lo-shoe-h17"
            : "hi-lo"
      });
    }
    const saved = writeBrowserAppData(nextData);
    setResult({
      correct,
      message: saved ? message : `${message} Progress could not be saved.`
    });
  }

  function next() {
    focusAfterNext.current = true;
    setSeed((value) => (value + 7919) >>> 0);
    setAnswer("");
    setFullAnswers(EMPTY_FULL_ANSWERS);
    setResult(null);
    setValidationError("");
    setStartedAt(performance.now());
  }

  return (
    <section className={styles.runner} aria-labelledby="scenario-heading">
      <header>
        <div>
          <span>Seed {seed}</span>
          <h2 id="scenario-heading" ref={headingRef} tabIndex={-1}>
            Scenario {score.attempts + 1}
          </h2>
        </div>
        <strong>
          {score.correct}/{score.attempts} correct
        </strong>
      </header>

      <div className={styles.prompt}>
        <span>{scenario.context}</span>
        <p>{scenario.prompt}</p>
      </div>

      {scenario.type !== "action" && scenario.cards !== undefined ? (
        <div className={styles.cardRun} aria-label="Counting card sequence">
          {scenario.cards.map((card, index) => (
            <b key={`${card}-${index}`}>{card}</b>
          ))}
        </div>
      ) : null}

      {scenario.type === "action" ? (
        <div
          className={styles.actionAnswers}
          role="group"
          aria-label="Answer choices"
        >
          {scenario.choices.map((action) => (
            <button
              aria-pressed={answer === action}
              disabled={result !== null}
              key={action}
              onClick={() =>
                submit(
                  action,
                  Math.max(0, Math.round(performance.now() - startedAt))
                )
              }
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      ) : scenario.type === "full-load" ? (
        <form
          className={styles.fullLoad}
          onSubmit={(event) => {
            event.preventDefault();
            submitFullLoad(
              Math.max(0, Math.round(performance.now() - startedAt))
            );
          }}
        >
          <div className={styles.fullFields}>
            {FULL_LOAD_FIELDS.map(({ label, field }) => (
              <label key={field}>
                <span>{label}</span>
                <input
                  disabled={result !== null}
                  inputMode="decimal"
                  onChange={(event) =>
                    setFullAnswers((current) => ({
                      ...current,
                      [field]: event.target.value
                    }))
                  }
                  required
                  value={fullAnswers[field]}
                />
              </label>
            ))}
          </div>
          <fieldset className={styles.fullActions}>
            <legend>Table action</legend>
            {ACTIONS.map((action) => (
              <label key={action}>
                <input
                  checked={fullAnswers.action === action}
                  disabled={result !== null}
                  name="full-action"
                  onChange={() =>
                    setFullAnswers((current) => ({ ...current, action }))
                  }
                  required
                  type="radio"
                  value={action}
                />
                {action}
              </label>
            ))}
          </fieldset>
          <button disabled={result !== null} type="submit">
            Score all five steps
          </button>
        </form>
      ) : (
        <form
          className={styles.numberAnswer}
          onSubmit={(event) => {
            event.preventDefault();
            submit(
              answer,
              Math.max(0, Math.round(performance.now() - startedAt))
            );
          }}
        >
          <label>
            <span>Your answer</span>
            <input
              disabled={result !== null}
              inputMode="decimal"
              onChange={(event) => setAnswer(event.target.value)}
              required
              value={answer}
            />
          </label>
          <button disabled={result !== null} type="submit">
            Check answer
          </button>
        </form>
      )}

      <footer
        aria-live="polite"
        className={result?.correct ? styles.correct : styles.incorrect}
      >
        <p>
          {validationError ||
            result?.message ||
            "Commit to an answer before revealing the model."}
        </p>
        {result === null ? null : (
          <button onClick={next} type="button">
            Next deterministic scenario
          </button>
        )}
      </footer>
    </section>
  );
}
