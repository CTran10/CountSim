// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  EMPTY_APP_DATA,
  saveCustomGame,
  writeAppData
} from "../../lib/storage";
import { SessionSetupForm } from "./SessionSetupForm";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SessionSetupForm", () => {
  it("only enables intents that the selected mode can score", async () => {
    const user = userEvent.setup();
    render(<SessionSetupForm presetId="lodge-dd" tableMinimumCents={500} />);

    expect(screen.getByRole("radio", { name: "Observation" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Discipline" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Running count" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Full game" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Practice" }));
    expect(screen.getByRole("radio", { name: "Running count" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "Running count" }));
    expect(screen.getByRole("radio", { name: "Running count" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Decision" }));
    expect(screen.getByRole("radio", { name: "Running count" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Full game" })).toBeChecked();
  });

  it("disables deviation intent for a basic-strategy-only custom game", async () => {
    const customData = saveCustomGame(EMPTY_APP_DATA, {
      id: "custom-basic-only",
      name: "Basic Only",
      rules: { decks: 6, deviationProfile: "basic-strategy-only" },
      penetration: { mode: "fixed", value: 0.75 },
      shuffle: "perfect_random"
    });
    expect(writeAppData(window.localStorage, customData)).toBe(true);
    const user = userEvent.setup();
    render(
      <SessionSetupForm presetId="custom-basic-only" tableMinimumCents={500} />
    );

    await user.click(screen.getByRole("radio", { name: "Decision" }));

    expect(screen.getByRole("radio", { name: "Deviations" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Discipline" })).toBeChecked();
  });
});
