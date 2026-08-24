import Link from "next/link";

import { PageHeader } from "../components/PageHeader";
import { HomeDashboard } from "../features/home/HomeDashboard";
import styles from "./sections.module.css";

export default function Page() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={styles.actionLink} href="/games">
              Choose a game
            </Link>
            <Link className={styles.secondaryLink} href="/drill">
              Start a drill
            </Link>
          </>
        }
        eyebrow="Blackjack training lab"
        summary="Play deterministic shoes built around the rules you expect to face. Learn the count, the index, and the reason for every decision."
        title="Practice the game, not a generic chart."
      />

      <HomeDashboard />

      <section
        className={styles.definitionGrid}
        aria-label="How TrueEdge works"
      >
        <div>
          <span>Select</span>
          <p>Choose a sourced Black Hawk preset or define a custom ruleset.</p>
        </div>
        <div>
          <span>Play</span>
          <p>Work through seeded shoes with visible cut-card behavior.</p>
        </div>
        <div>
          <span>Review</span>
          <p>
            Separate technical decision quality from virtual profit and loss.
          </p>
        </div>
      </section>
    </>
  );
}
