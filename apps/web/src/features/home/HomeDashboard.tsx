"use client";

import {
  scheduleTrainingItems,
  type SkillId,
  type SkillScore,
  type TrainingItem
} from "@trueedge/game-core";
import Link from "next/link";
import { useMemo } from "react";

import sectionStyles from "../../app/sections.module.css";
import { SkillBar } from "../../components/PageHeader";
import type { StoredSkillId } from "../../lib/storage";
import { useAppData } from "../../lib/useAppData";

const SKILLS: readonly {
  readonly id: StoredSkillId;
  readonly core: SkillId;
  readonly label: string;
  readonly detail: string;
  readonly route: string;
}[] = [
  {
    id: "basic_strategy",
    core: "basic_strategy",
    label: "Basic strategy",
    detail: "Rule-aware decisions",
    route: "basic-strategy"
  },
  {
    id: "running_count",
    core: "running_count",
    label: "Running count",
    detail: "Hi-Lo continuity",
    route: "running-count"
  },
  {
    id: "deck_estimation",
    core: "deck_estimation",
    label: "Deck estimation",
    detail: "Shoe reading",
    route: "deck-estimation"
  },
  {
    id: "true_count",
    core: "true_count",
    label: "True count",
    detail: "Conversion and resolution",
    route: "true-count"
  },
  {
    id: "deviations",
    core: "deviations",
    label: "Index deviations",
    detail: "I18 and Fab 4",
    route: "deviations"
  },
  {
    id: "insurance",
    core: "insurance",
    label: "Insurance",
    detail: "Count-based insurance",
    route: "insurance"
  }
];

function score(correct: number, attempts: number): number {
  if (attempts === 0) return 0;
  const accuracy = correct / attempts;
  return Math.round(accuracy * 85 + Math.min(attempts / 10, 1) * 15);
}

export function HomeDashboard() {
  const data = useAppData();
  const recommendation = useMemo(() => {
    const recentMisses = new Set(
      data.drillAttempts
        .slice(0, 12)
        .filter((attempt) => !attempt.correct)
        .map((attempt) => attempt.skill)
    );
    const profile: SkillScore[] = SKILLS.map((definition) => {
      const stored = data.skills.find((skill) => skill.id === definition.id);
      const attempts = stored?.attempts ?? 0;
      const correct = stored?.correct ?? 0;
      return {
        skill: definition.core,
        attempts,
        correct,
        streak: 0,
        score: Math.max(
          0,
          score(correct, attempts) - (recentMisses.has(definition.id) ? 20 : 0)
        )
      };
    });
    const items: TrainingItem[] = SKILLS.map((definition) => ({
      id: definition.id,
      skills: [definition.core],
      difficulty: definition.id === "deviations" ? 4 : 3
    }));
    const first = scheduleTrainingItems({
      items,
      profile,
      seed: 785390425,
      count: 1
    })[0];
    return (
      SKILLS.find((definition) => definition.id === first?.id) ?? SKILLS[0]!
    );
  }, [data]);

  const noAttempts = data.skills.every((skill) => skill.attempts === 0);

  return (
    <div className={sectionStyles.homeGrid}>
      <section className={sectionStyles.panel} aria-labelledby="skill-heading">
        <div className={sectionStyles.panelHeader}>
          <h2 id="skill-heading">Skill baseline</h2>
          <span>
            {noAttempts
              ? "First run"
              : `${data.drillAttempts.length} recent attempts`}
          </span>
        </div>
        {SKILLS.map((definition) => {
          const stored = data.skills.find(
            (skill) => skill.id === definition.id
          );
          const attempts = stored?.attempts ?? 0;
          const correct = stored?.correct ?? 0;
          return (
            <SkillBar
              detail={
                attempts === 0
                  ? `${definition.detail}. No attempts yet.`
                  : `${correct} of ${attempts} correct`
              }
              key={definition.id}
              label={definition.label}
              value={score(correct, attempts)}
            />
          );
        })}
      </section>

      <aside
        className={`${sectionStyles.quietPanel} ${sectionStyles.continueBlock}`}
      >
        <div className={sectionStyles.panelHeader}>
          <h2>Suggested next</h2>
          <span>Seeded scheduler</span>
        </div>
        <div className={sectionStyles.nextSession}>
          <span>{noAttempts ? "Build a baseline" : "Weighted weak skill"}</span>
          <strong>{recommendation.label}</strong>
          <small>Accuracy, evidence, and recent misses set the weight.</small>
        </div>
        <p>
          Technical skill stays separate from virtual profit. The schedule is
          reproducible and favors weak or recently missed work.
        </p>
        <Link
          className={sectionStyles.actionLink}
          href={`/drill?kind=${recommendation.route}`}
        >
          Practice {recommendation.label.toLowerCase()}
        </Link>
      </aside>
    </div>
  );
}
