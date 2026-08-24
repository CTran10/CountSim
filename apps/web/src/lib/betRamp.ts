export const BET_RAMP_UNITS = [1, 2, 4, 6, 8] as const;

export function betUnitsForTrueCount(trueCount: number): number {
  if (trueCount <= 0) return 1;
  if (trueCount === 1) return 2;
  if (trueCount === 2) return 4;
  if (trueCount === 3) return 6;
  return 8;
}

export function wagerForUnits(
  units: number,
  tableMinimumCents: number,
  maxBetCents: number
): number {
  return Math.min(units * tableMinimumCents, maxBetCents);
}

export function wagerChoices(
  tableMinimumCents: number,
  maxBetCents: number
): readonly number[] {
  if (tableMinimumCents > maxBetCents) return [];
  return [
    ...new Set(
      BET_RAMP_UNITS.map((units) =>
        wagerForUnits(units, tableMinimumCents, maxBetCents)
      )
    )
  ];
}
