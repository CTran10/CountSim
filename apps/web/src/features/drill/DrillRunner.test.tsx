// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readAppData } from "../../lib/storage";
import { buildCountPracticeScenario, DrillRunner } from "./DrillRunner";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("DrillRunner", () => {
  it("scores card value, running count, and true count together", async () => {
    const user = userEvent.setup();
    const scenario = buildCountPracticeScenario(12_041);
    render(<DrillRunner kind="count-practice" />);

    expect(
      screen.getByLabelText(
        `Outlined card: ${scenario.cards[scenario.focusIndex]}`
      )
    ).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Outlined card value" }),
      String(scenario.cardValue)
    );
    await user.type(
      screen.getByRole("textbox", { name: "Final running count" }),
      String(scenario.runningCount)
    );
    await user.type(
      screen.getByRole("textbox", { name: "Truncated true count" }),
      String(scenario.trueCount)
    );
    await user.click(
      screen.getByRole("button", { name: "Score count practice" })
    );

    expect(screen.getByText(/3\/3 correct\./u)).toBeVisible();
    const attempts = readAppData(window.localStorage).drillAttempts;
    expect(attempts).toHaveLength(3);
    expect(
      attempts.filter((attempt) => attempt.skill === "running_count")
    ).toHaveLength(2);
    expect(
      attempts.filter((attempt) => attempt.skill === "true_count")
    ).toHaveLength(1);
    expect(attempts.every((attempt) => attempt.correct)).toBe(true);
  });

  it("trains insurance separately and retains repeated deterministic attempts", async () => {
    const user = userEvent.setup();
    render(<DrillRunner kind="insurance" />);

    await user.click(screen.getByRole("button", { name: "decline" }));
    await user.click(
      screen.getByRole("button", { name: "Next deterministic scenario" })
    );
    expect(screen.getByRole("heading", { name: "Scenario 2" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "decline" }));

    const attempts = readAppData(window.localStorage).drillAttempts;
    expect(attempts).toHaveLength(2);
    expect(attempts.every((attempt) => attempt.skill === "insurance")).toBe(
      true
    );
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(2);
  });

  it("scores the full mental-load chain as four technical skills plus a bet", async () => {
    const user = userEvent.setup();
    render(<DrillRunner kind="full-load" />);

    await user.type(screen.getByLabelText("Final RC"), "8");
    await user.type(screen.getByLabelText("Decks remain"), "4");
    await user.type(screen.getByLabelText("True count"), "2");
    await user.type(screen.getByLabelText("Bet units"), "4");
    await user.click(screen.getByRole("radio", { name: "hit" }));
    await user.click(
      screen.getByRole("button", { name: "Score all five steps" })
    );

    expect(screen.getByText(/5\/5 steps correct/u)).toBeInTheDocument();
    const attempts = readAppData(window.localStorage).drillAttempts;
    expect(attempts).toHaveLength(4);
    expect(attempts.map((attempt) => attempt.skill)).toEqual(
      expect.arrayContaining([
        "running_count",
        "deck_estimation",
        "true_count",
        "basic_strategy"
      ])
    );
    expect(attempts.every((attempt) => attempt.correct)).toBe(true);
    expect(
      attempts.map((attempt) => [attempt.submitted, attempt.expected])
    ).toEqual(
      expect.arrayContaining([
        ["8", "8"],
        ["4", "4.0"],
        ["2", "2"],
        ["hit", "hit"]
      ])
    );
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(4);
  });

  it("rejects whitespace numeric answers without scoring or persisting", async () => {
    const user = userEvent.setup();
    render(<DrillRunner kind="running-count" />);

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), " ");
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(
      screen.getByText("Enter a numeric answer before checking it.")
    ).toBeVisible();
    expect(readAppData(window.localStorage).drillAttempts).toHaveLength(0);
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
  });

  it("surfaces browser persistence failures without crashing the drill", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const user = userEvent.setup();
    render(<DrillRunner kind="insurance" />);

    await user.click(screen.getByRole("button", { name: "decline" }));

    expect(screen.getByText(/Progress could not be saved\./u)).toBeVisible();
  });
});
