"use client";

import Link from "next/link";

import { SkillBar } from "../../components/PageHeader";
import type { StoredDrillAttempt, StoredSkillId } from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";
import sectionStyles from "../../app/sections.module.css";
import styles from "./ProgressView.module.css";

const LABELS = {
  basic_strategy: "Basic strategy",
  running_count: "Running count",
  deck_estimation: "Deck estimation",
  true_count: "True count",
  deviations: "Index deviations",
  insurance: "Insurance"
} as const;

function score(correct: number, attempts: number): number {
  return attempts === 0 ? 0 : Math.round((correct / attempts) * 100);
}

const ROUTES = {
  basic_strategy: "basic-strategy",
  running_count: "running-count",
  deck_estimation: "deck-estimation",
  true_count: "true-count",
  deviations: "deviations",
  insurance: "insurance"
} as const;

function trendFor(
  skill: StoredSkillId,
  attempts: readonly StoredDrillAttempt[]
): string {
  const recent = attempts.filter((attempt) => attempt.skill === skill);
  const latest = recent.slice(0, 5);
  const prior = recent.slice(5, 10);
  if (latest.length === 0 || prior.length === 0) return "trend pending";
  const latestRate =
    latest.filter((attempt) => attempt.correct).length / latest.length;
  const priorRate =
    prior.filter((attempt) => attempt.correct).length / prior.length;
  const change = Math.round((latestRate - priorRate) * 100);
  return `${change > 0 ? "+" : ""}${change} point trend`;
}

export function ProgressView() {
  const data = useAppData();

  const ranked = [...data.skills].sort(
    (left, right) =>
      score(left.correct, left.attempts) - score(right.correct, right.attempts)
  );
  const weakest = ranked[0];

  return (
    <div className={styles.layout}>
      <section className={sectionStyles.panel} aria-label="Skill progress">
        <div className={sectionStyles.panelHeader}>
          <h2>Current mastery</h2>
          <span>{data.sessions.length} completed sessions</span>
        </div>
        {data.skills.map((skill) => (
          <SkillBar
            detail={
              skill.attempts === 0
                ? "Baseline until first attempt"
                : `${skill.correct} of ${skill.attempts} correct · ${trendFor(skill.id, data.drillAttempts)}`
            }
            key={skill.id}
            label={LABELS[skill.id]}
            value={score(skill.correct, skill.attempts)}
          />
        ))}
      </section>

      <aside className={styles.recommendation}>
        <span>Adaptive recommendation</span>
        <strong>
          {weakest === undefined ? "Build a baseline" : LABELS[weakest.id]}
        </strong>
        <p>
          The scheduler increases weak-skill frequency while retaining a small
          share of mixed review.
        </p>
        <Link
          className={sectionStyles.actionLink}
          href={
            weakest === undefined
              ? "/drill"
              : `/drill?kind=${ROUTES[weakest.id]}`
          }
        >
          Start focused drill
        </Link>
      </aside>

      <section className={styles.recent} aria-labelledby="recent-heading">
        <div className={sectionStyles.panelHeader}>
          <h2 id="recent-heading">Recent misses</h2>
          <span>Locally stored drill attempts</span>
        </div>
        {data.drillAttempts.filter((attempt) => !attempt.correct).length ===
        0 ? (
          <p>No missed drill attempts recorded yet.</p>
        ) : (
          <ol>
            {data.drillAttempts
              .filter((attempt) => !attempt.correct)
              .slice(0, 8)
              .map((attempt) => (
                <li key={attempt.id}>
                  <span>{LABELS[attempt.skill]}</span>
                  <strong>
                    <span className={styles.valueLabel}>Submitted</span>
                    {attempt.submitted || "No answer"}
                  </strong>
                  <b>
                    <span className={styles.valueLabel}>Expected</span>
                    {attempt.expected}
                  </b>
                  <small>
                    <span className={styles.valueLabel}>Time</span>
                    {Math.round(attempt.decisionTimeMs / 100) / 10}s
                  </small>
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
