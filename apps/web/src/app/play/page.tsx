import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BlackjackTable } from "../../features/table/BlackjackTable";
import { generateSessionSeed } from "../../lib/seed";
import { buildSeededPlayUrl, parseSessionQuery } from "../../lib/sessionQuery";

export const metadata: Metadata = { title: "Table | TrueEdge" };
export const dynamic = "force-dynamic";

export default async function PlayPage({
  searchParams
}: {
  readonly searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}) {
  const query = await searchParams;
  if (query.seed === undefined) {
    redirect(buildSeededPlayUrl(query, generateSessionSeed()));
  }
  const parsed = parseSessionQuery(query);
  const tableKey = JSON.stringify({
    config: parsed.config,
    mode: parsed.mode,
    presetLabel: parsed.presetLabel,
    tableMinimumCents: parsed.tableMinimumCents
  });
  return (
    <>
      <h1 className="sr-only">Blackjack practice table</h1>
      <BlackjackTable
        config={parsed.config}
        key={tableKey}
        mode={parsed.mode}
        presetLabel={parsed.presetLabel}
        seed={parsed.config.seed}
        tableMinimumCents={parsed.tableMinimumCents}
      />
    </>
  );
}
