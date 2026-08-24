import type { Metadata } from "next";

import { PageHeader } from "../../components/PageHeader";
import { ReviewView } from "../../features/review/ReviewView";

export const metadata: Metadata = { title: "Review | TrueEdge" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Session review"
        summary="Completed local sessions appear here with decision quality, discipline, and a replayable mistake timeline."
        title="Review the reasoning, not the runout."
      />
      <ReviewView />
    </>
  );
}
