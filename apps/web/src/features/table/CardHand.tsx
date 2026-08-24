import type { Card } from "@trueedge/game-core";
import Image from "next/image";
import type { CSSProperties } from "react";

import { cardAsset, cardLabel } from "../../lib/format";
import styles from "./BlackjackTable.module.css";

interface CardHandProps {
  readonly cards: readonly (Card | null)[];
  readonly label: string;
  readonly total: number | null;
  readonly owner: "dealer" | "player";
  readonly active?: boolean;
  readonly result?: string;
}

function PlayingCard({
  card,
  owner,
  index
}: {
  readonly card: Card | null;
  readonly owner: CardHandProps["owner"];
  readonly index: number;
}) {
  const hole = card === null;
  const testId = hole ? "dealer-hole-card" : `${owner}-card`;
  const dealOrder = index * 2 + (owner === "dealer" ? 1 : 0);
  const cardStyle = {
    "--deal-delay": `${Math.min(dealOrder, 8) * 55}ms`
  } as CSSProperties;

  return (
    <div
      className={`${styles.card} ${owner === "dealer" ? styles.dealerCard : styles.playerCard}`}
      data-deal-order={dealOrder}
      data-testid={testId}
      style={cardStyle}
    >
      <Image
        alt={hole ? "Face-down dealer card" : cardLabel(card)}
        className={styles.cardImage}
        height={144}
        priority={index < 2}
        src={hole ? "/cards/back.svg" : cardAsset(card)}
        width={102}
      />
    </div>
  );
}

export function CardHand({
  cards,
  label,
  total,
  owner,
  active = false,
  result
}: CardHandProps) {
  return (
    <section
      aria-current={active ? "true" : undefined}
      aria-label={`${label} hand`}
      className={`${styles.hand} ${active ? styles.activeHand : ""}`}
    >
      <div className={styles.handHeading}>
        <h2>{label}</h2>
        <div>
          {result === undefined ? null : <small>{result}</small>}
          <strong>{total === null ? "--" : total}</strong>
        </div>
      </div>
      <div className={styles.cards}>
        {cards.length === 0 ? (
          <div aria-hidden="true" className={styles.emptyHand}>
            <span />
            <span />
          </div>
        ) : (
          cards.map((card, index) => (
            <PlayingCard
              card={card}
              index={index}
              key={card?.id ?? `dealer-hole-${index}`}
              owner={owner}
            />
          ))
        )}
      </div>
    </section>
  );
}
