import type { Metadata } from "next";

import { PageHeader } from "../../components/PageHeader";
import { GameCatalog } from "../../features/games/GameCatalog";

export const metadata: Metadata = { title: "Games | TrueEdge" };

export default function GamesPage() {
  return (
    <>
      <PageHeader title="Games" />

      <GameCatalog />
    </>
  );
}
