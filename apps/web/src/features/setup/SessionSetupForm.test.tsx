// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SELECTED_GAME_STORAGE_KEY } from "../../lib/gamePreference";
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
  it("persists the selected game when setup opens", async () => {
    render(
      <SessionSetupForm presetId="ballys-north-dd" tableMinimumCents={1500} />
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
        "ballys-north-dd"
      );
    });
  });

  it("switches to a compatible mode when an intent needs one", async () => {
    const user = userEvent.setup();
    render(<SessionSetupForm presetId="lodge-dd" tableMinimumCents={500} />);

    expect(screen.getByRole("radio", { name: "Observation" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Discipline" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Running count" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Full game" })).toBeEnabled();

    await user.click(screen.getByRole("radio", { name: "Running count" }));
    expect(screen.getByRole("radio", { name: "Running count" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Practice" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Decision" }));
    expect(screen.getByRole("radio", { name: "Full game" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Observation" }));
    await user.click(screen.getByRole("radio", { name: "Basic strategy" }));
    expect(screen.getByRole("radio", { name: "Basic strategy" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Decision" })).toBeChecked();
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
