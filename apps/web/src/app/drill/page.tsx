import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "../../components/PageHeader";
import { DrillPicker } from "../../features/drill/DrillPicker";
import { DrillRunner } from "../../features/drill/DrillRunner";
import { generateSessionSeed } from "../../lib/seed";
import styles from "../sections.module.css";

export const metadata: Metadata = { title: "Drills | TrueEdge" };
export const dynamic = "force-dynamic";

function formatKind(kind: string): string {
  return kind
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function DrillPage({
  searchParams
}: {
  readonly searchParams: Promise<{ readonly kind?: string | string[] }>;
}) {
  const query = await searchParams;
  const kind = typeof query.kind === "string" ? query.kind : null;

  if (kind !== null) {
    return (
      <>
        <PageHeader
          actions={
            <Link className={styles.secondaryLink} href="/drill">
              All drills
            </Link>
          }
          eyebrow="Generated training scenario"
          summary="A seeded attempt set will reproduce the same prompts, answer key, and score."
          title={formatKind(kind)}
        />
        <DrillRunner initialSeed={generateSessionSeed()} kind={kind} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Drill lab"
        summary="Short, targeted work for one skill at a time, plus a full-load mode that combines the complete reasoning chain."
        title="Train the step that breaks under pressure."
      />
      <DrillPicker />
    </>
  );
}
