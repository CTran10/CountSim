import type { Metadata } from "next";

import { PageHeader } from "../../components/PageHeader";
import { GameCatalog } from "../../features/games/GameCatalog";

export const metadata: Metadata = { title: "Games | TrueEdge" };

export default function GamesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Black Hawk catalog"
        summary="Preset data is intentionally conservative. Rules and cut-card depth can move by table, dealer, and shift."
        title="Pick the game you mean to practice."
      />

      <GameCatalog />
    </>
  );
}
