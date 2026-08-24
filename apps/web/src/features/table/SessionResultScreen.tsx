"use client";

import { useEffect, useRef } from "react";

import styles from "./BlackjackTable.module.css";

export type SessionResultTone =
  "win" | "stop-loss" | "bankroll-depleted" | "loss" | "flat";

interface SessionResultScreenProps {
  readonly tone: SessionResultTone;
  readonly kicker: string;
  readonly title: string;
  readonly message: string;
  readonly deltaLabel: string;
  readonly bankrollLabel: string;
  readonly error: string;
  readonly saving: boolean;
  readonly onReview: () => void;
}

const TONE_CLASSES: Readonly<Record<SessionResultTone, string>> = {
  win: styles.sessionResultWin!,
  "stop-loss": styles.sessionResultStopLoss!,
  "bankroll-depleted": styles.sessionResultDepleted!,
  loss: styles.sessionResultLoss!,
  flat: styles.sessionResultFlat!
};

export function SessionResultScreen({
  tone,
  kicker,
  title,
  message,
  deltaLabel,
  bankrollLabel,
  error,
  saving,
  onReview
}: SessionResultScreenProps) {
  const reviewButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reviewButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <section
      aria-describedby="session-result-message"
      aria-labelledby="session-result-title"
      aria-modal="true"
      className={`${styles.sessionResultScreen} ${TONE_CLASSES[tone]}`}
      data-session-result={tone}
      role="dialog"
    >
      <div aria-hidden="true" className={styles.sessionResultBackdrop} />
      {tone === "win" ? (
        <div aria-hidden="true" className={styles.sessionConfetti}>
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : null}
      <div className={styles.sessionResultPanel}>
        <span className={styles.sessionResultKicker}>{kicker}</span>
        <h2 id="session-result-title">{title}</h2>
        <p id="session-result-message">{message}</p>
        <dl className={styles.sessionResultStats}>
          <div>
            <dt>Session result</dt>
            <dd>{deltaLabel}</dd>
          </div>
          <div>
            <dt>Practice bankroll</dt>
            <dd>{bankrollLabel}</dd>
          </div>
        </dl>
        {error === "" ? null : (
          <p className={styles.sessionResultError} role="status">
            {error}
          </p>
        )}
        <button
          disabled={saving}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            reviewButtonRef.current?.focus();
          }}
          onClick={onReview}
          ref={reviewButtonRef}
          type="button"
        >
          {saving ? "Saving session" : "Open session review"}
        </button>
      </div>
    </section>
  );
}
