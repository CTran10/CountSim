// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SELECTED_GAME_STORAGE_KEY } from "../lib/gamePreference";
import { EMPTY_APP_DATA, writeBrowserAppData } from "../lib/storage";
import { THEME_STORAGE_KEY } from "../lib/theme";
import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/"
}));

const storedValues = new Map<string, string>();
const storage: Storage = {
  get length() {
    return storedValues.size;
  },
  clear() {
    storedValues.clear();
  },
  getItem(key) {
    return storedValues.get(key) ?? null;
  },
  key(index) {
    return [...storedValues.keys()][index] ?? null;
  },
  removeItem(key) {
    storedValues.delete(key);
  },
  setItem(key, value) {
    storedValues.set(key, value);
  }
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.dataset.theme = "dark";
});

describe("AppShell", () => {
  it("replaces the sidebar branding and footer with a dark-mode toggle", async () => {
    const user = userEvent.setup();
    render(<AppShell>Content</AppShell>);

    expect(screen.queryByText("TrueEdge")).not.toBeInTheDocument();
    expect(screen.queryByText("Local training")).not.toBeInTheDocument();
    expect(screen.queryByText("Virtual funds only")).not.toBeInTheDocument();

    const toggles = screen.getAllByRole("switch", {
      name: "Switch to light mode"
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute("aria-checked", "true");

    await user.click(toggles[0]!);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(
      screen.getAllByRole("switch", { name: "Switch to dark mode" })[0]
    ).toHaveAttribute("aria-checked", "false");
  });

  it("restores a saved light-mode choice", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });
    expect(
      screen.getAllByRole("switch", { name: "Switch to dark mode" })[0]
    ).toHaveAttribute("aria-checked", "false");
  });

  it("keeps Session and Table navigation on the selected game", async () => {
    window.localStorage.setItem(SELECTED_GAME_STORAGE_KEY, "ballys-north-dd");
    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      for (const link of screen.getAllByRole("link", { name: "Session" })) {
        expect(link).toHaveAttribute("href", "/setup?preset=ballys-north-dd");
      }
      for (const link of screen.getAllByRole("link", { name: "Table" })) {
        expect(link).toHaveAttribute(
          "href",
          "/play?preset=ballys-north-dd&minBet=15"
        );
      }
    });
  });

  it("routes a selected saved game through setup so its rules can load", async () => {
    expect(
      writeBrowserAppData({
        ...EMPTY_APP_DATA,
        customGames: [
          {
            id: "custom-user-local-game",
            name: "Local game",
            penetration: { mode: "fixed", value: 0.75 },
            shuffle: "perfect_random",
            rules: {
              decks: 6,
              blackjackPayout: "3:2",
              dealerSoft17: "H17",
              doubleRule: "any_two",
              doubleAfterSplit: true,
              resplitAces: true,
              hitSplitAces: false,
              doubleSplitAces: false,
              surrender: "none",
              maxSplitHands: 4,
              dealerPeek: true,
              burnCard: false,
              deviationProfile: "hilo-6d-h17-das-rsa"
            }
          }
        ]
      })
    ).toBe(true);
    window.localStorage.setItem(
      SELECTED_GAME_STORAGE_KEY,
      "custom-user-local-game"
    );
    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      for (const link of screen.getAllByRole("link", { name: "Table" })) {
        expect(link).toHaveAttribute(
          "href",
          "/setup?preset=custom-user-local-game"
        );
      }
    });
  });
});
