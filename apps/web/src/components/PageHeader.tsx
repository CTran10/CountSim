import type { ReactNode } from "react";

import styles from "./UI.module.css";

export function PageHeader({
  eyebrow,
  title,
  summary,
  actions
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{summary}</span>
      </div>
      {actions === undefined ? null : (
        <div className={styles.headerActions}>{actions}</div>
      )}
    </header>
  );
}

export function SkillBar({
  label,
  value,
  detail
}: {
  readonly label: string;
  readonly value: number;
  readonly detail?: string;
}) {
  return (
    <div className={styles.skillRow}>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <progress aria-label={`${label} mastery`} max={100} value={value} />
      <b>{value}%</b>
    </div>
  );
}
