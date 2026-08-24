import Link from "next/link";

import styles from "./DrillPicker.module.css";

const DRILLS = [
  {
    id: "running-count",
    code: "RC",
    title: "Running count",
    detail: "Maintain Hi-Lo through a rapid exposed-card sequence."
  },
  {
    id: "deck-estimation",
    code: "DE",
    title: "Deck estimation",
    detail: "Read the shoe at whole, half, or quarter-deck resolution."
  },
  {
    id: "true-count",
    code: "TC",
    title: "True count",
    detail: "Convert running count using the selected rounding convention."
  },
  {
    id: "basic-strategy",
    code: "BS",
    title: "Basic strategy",
    detail: "Resolve hard, soft, and pair hands against live rule profiles."
  },
  {
    id: "deviations",
    code: "IX",
    title: "Index deviations",
    detail: "Practice the I18 and Fab 4 against compatible games."
  },
  {
    id: "insurance",
    code: "IN",
    title: "Insurance",
    detail: "Use the ruleset-specific Hi-Lo threshold against a dealer ace."
  },
  {
    id: "penetration",
    code: "PN",
    title: "Penetration",
    detail: "Estimate cards or decks cut and judge the game depth."
  },
  {
    id: "full-load",
    code: "FL",
    title: "Full mental load",
    detail: "Count, estimate, convert, bet, and choose the play together."
  }
] as const;

export function DrillPicker() {
  return (
    <div className={styles.grid}>
      {DRILLS.map((drill) => (
        <article className={styles.drill} key={drill.id}>
          <span aria-hidden="true">{drill.code}</span>
          <div>
            <h2>{drill.title}</h2>
            <p>{drill.detail}</p>
          </div>
          <Link href={`/drill?kind=${drill.id}`}>Open drill</Link>
        </article>
      ))}
    </div>
  );
}
