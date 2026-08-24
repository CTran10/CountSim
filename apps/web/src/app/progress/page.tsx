import type { Metadata } from "next";

import { PageHeader } from "../../components/PageHeader";
import { ProgressView } from "../../features/progress/ProgressView";

export const metadata: Metadata = { title: "Progress | TrueEdge" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        eyebrow="Progress"
        summary="Each skill is scored separately so a lucky session cannot hide a weak decision process. Data stays in this browser."
        title="A technical record of your practice."
      />
      <ProgressView />
    </>
  );
}
