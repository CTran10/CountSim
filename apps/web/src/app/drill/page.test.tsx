// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateSessionSeed } from "../../lib/seed";
import DrillPage from "./page";

vi.mock("../../features/drill/DrillRunner", () => ({
  DrillRunner: ({
    initialSeed,
    kind
  }: {
    readonly initialSeed: number;
    readonly kind: string;
  }) => (
    <div data-kind={kind} data-seed={initialSeed} data-testid="drill-runner" />
  )
}));

vi.mock("../../lib/seed", () => ({
  generateSessionSeed: vi.fn(() => 93_817)
}));

afterEach(cleanup);

describe("DrillPage", () => {
  it("starts each rendered drill session with a generated seed", async () => {
    render(
      await DrillPage({
        searchParams: Promise.resolve({ kind: "count-practice" })
      })
    );

    expect(generateSessionSeed).toHaveBeenCalledOnce();
    expect(screen.getByTestId("drill-runner")).toHaveAttribute(
      "data-kind",
      "count-practice"
    );
    expect(screen.getByTestId("drill-runner")).toHaveAttribute(
      "data-seed",
      "93817"
    );
  });
});
