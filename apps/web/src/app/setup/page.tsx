import type { Metadata } from "next";

import { PageHeader } from "../../components/PageHeader";
import { SessionSetupForm } from "../../features/setup/SessionSetupForm";
import { catalogTableMinimumCents } from "../../lib/catalogPreset";

export const metadata: Metadata = { title: "Session setup | TrueEdge" };

export default async function SetupPage({
  searchParams
}: {
  readonly searchParams: Promise<{ readonly preset?: string | string[] }>;
}) {
  const query = await searchParams;
  const presetId = typeof query.preset === "string" ? query.preset : "lodge-6d";
  const tableMinimumCents = catalogTableMinimumCents(presetId) ?? 500;

  return (
    <>
      <PageHeader
        eyebrow="Session setup"
        summary="Set the practice goal and hard virtual-bankroll limits before the first card. The selected game rules remain fixed for the session."
        title="Define the session before variance does."
      />
      <SessionSetupForm
        presetId={presetId}
        tableMinimumCents={tableMinimumCents}
      />
    </>
  );
}
