import { runDeterministicSimulation } from "@trueedge/game-core";

import { HELP_TEXT, parseArgs } from "./args.ts";
import { formatSimulation } from "./format.ts";

try {
  const options = parseArgs(process.argv.slice(2));
  const result = runDeterministicSimulation({
    seed: options.seed,
    rounds: options.rounds,
    rules: options.rules,
    profile: options.deviationProfileId,
    penetration: options.penetration,
    trueCountThreshold: options.threshold
  });
  process.stdout.write(
    options.json
      ? `${JSON.stringify({ presetId: options.presetId, penetration: options.penetration, ...result }, null, 2)}\n`
      : `${formatSimulation(result, options.presetId, options.penetration)}\n`
  );
} catch (error) {
  if (error instanceof Error && error.message === "HELP") {
    process.stdout.write(`${HELP_TEXT}\n`);
    process.exitCode = 0;
  } else {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Simulation failed."}\n\n${HELP_TEXT}\n`
    );
    process.exitCode = 1;
  }
}
