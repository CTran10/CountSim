import type { Metadata } from "next";

import { BlackjackTable } from "../../features/table/BlackjackTable";
import { parseSessionQuery } from "../../lib/sessionQuery";

export const metadata: Metadata = { title: "Table | TrueEdge" };

export default async function PlayPage({
  searchParams
}: {
  readonly searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}) {
  const parsed = parseSessionQuery(await searchParams);
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
