import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    exclude: ["apps/web/e2e/**", "**/node_modules/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      include: [
        "packages/game-core/src/**/*.ts",
        "packages/casino-catalog/src/**/*.ts",
        "apps/cli/src/{args,format}.ts",
        "apps/web/src/features/table/TrainingRail.tsx",
        "apps/web/src/lib/{seed,sessionQuery,storage}.ts"
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
