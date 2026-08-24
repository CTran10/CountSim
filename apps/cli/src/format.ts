import type { DeterministicSimulationResult } from "@trueedge/game-core";

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatSimulation(
  result: DeterministicSimulationResult,
  presetId: string,
  penetration: number
): string {
  const metrics = result.metrics;
  return [
    "TrueEdge deterministic simulation",
    `Preset        ${presetId}`,
    `Seed          ${result.seed}`,
    `Profile       ${result.profileId}`,
    `Penetration   ${percent(penetration)}`,
    `Rounds        ${metrics.rounds}`,
    `Hands         ${metrics.hands}`,
    `Win rate      ${percent(metrics.winRate)}`,
    `Loss rate     ${percent(metrics.lossRate)}`,
    `Blackjacks    ${metrics.blackjacks}`,
    `Pushes        ${metrics.pushes}`,
    `Surrenders    ${metrics.surrenders}`,
    `TC chances    ${metrics.trueCountThresholdOpportunities}`,
    `Index capture ${metrics.deviationsTriggered}/${metrics.deviationOpportunities} (${percent(metrics.deviationCaptureRate)})`
  ].join("\n");
}
