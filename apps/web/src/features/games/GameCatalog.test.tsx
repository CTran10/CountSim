// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SELECTED_GAME_ID,
  getSelectedGameSnapshot,
  SELECTED_GAME_STORAGE_KEY,
  updateSelectedGameId
} from "../../lib/gamePreference";
import { readAppData } from "../../lib/storage";
import { GameCatalog } from "./GameCatalog";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("GameCatalog", () => {
  it("renders a quiet preset list with per-game edit controls", async () => {
    const user = userEvent.setup();
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBeNull();
    render(<GameCatalog />);

    const presets = screen.getByRole("region", { name: "Preset games" });
    expect(within(presets).getAllByRole("article")).toHaveLength(10);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Compare selected games")
    ).not.toBeInTheDocument();

    await user.click(
      within(presets).getByRole("button", {
        name: "Edit The Lodge Casino Six Deck"
      })
    );

    expect(screen.getByRole("textbox", { name: "Game name" })).toHaveValue(
      "The Lodge Casino Six Deck"
    );
    expect(
      screen.getByRole("button", { name: "Save edited game" })
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save edited game" }));

    expect(readAppData(window.localStorage).customGames[0]?.id).toBe(
      "custom-catalog-lodge-6d"
    );
    expect(getSelectedGameSnapshot()).toBe("custom-catalog-lodge-6d");
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      "custom-catalog-lodge-6d"
    );
    const lodge = within(presets).getByRole("article", {
      name: "The Lodge Casino Six Deck"
    });
    expect(within(lodge).getByText("Edited preset")).toBeVisible();
    expect(
      within(lodge).getByRole("link", { name: "Practice" })
    ).toHaveAttribute("href", "/setup?preset=custom-catalog-lodge-6d");

    updateSelectedGameId("custom-catalog-lodge-6d");
    await user.click(
      within(lodge).getByRole("button", { name: "Delete game" })
    );

    expect(getSelectedGameSnapshot()).toBe("lodge-6d");
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      "lodge-6d"
    );
  });

  it("restores a non-default source preset after deleting its edits", async () => {
    const user = userEvent.setup();
    updateSelectedGameId("ballys-north-dd");
    render(<GameCatalog />);

    const ballys = screen.getByRole("article", {
      name: "Bally's North Double Deck"
    });
    await user.click(
      within(ballys).getByRole("button", {
        name: "Edit Bally's North Double Deck"
      })
    );
    await user.click(
      within(ballys).getByRole("button", { name: "Save edited game" })
    );

    expect(getSelectedGameSnapshot()).toBe("custom-catalog-ballys-north-dd");

    await user.click(
      within(ballys).getByRole("button", { name: "Delete game" })
    );

    expect(getSelectedGameSnapshot()).toBe("ballys-north-dd");
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      "ballys-north-dd"
    );
  });

  it("keeps reserved-looking custom names separate and restores focus after deletion", async () => {
    const user = userEvent.setup();
    render(<GameCatalog />);

    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.type(
      screen.getByRole("textbox", { name: "Game name" }),
      "Catalog Lodge 6D"
    );
    await user.click(screen.getByRole("button", { name: "Save custom game" }));

    expect(readAppData(window.localStorage).customGames[0]?.id).toBe(
      "custom-user-catalog-lodge-6d"
    );
    const savedGames = screen.getByRole("region", { name: "Saved games" });
    const savedGame = within(savedGames).getByRole("article", {
      name: "Catalog Lodge 6D"
    });
    expect(savedGame).toBeVisible();
    updateSelectedGameId("custom-user-catalog-lodge-6d");

    await user.click(
      within(savedGame).getByRole("button", {
        name: "Edit Catalog Lodge 6D"
      })
    );
    await user.click(
      within(savedGame).getByRole("button", { name: "Delete game" })
    );

    expect(screen.getByText("Deleted Catalog Lodge 6D.")).toBeInTheDocument();
    expect(getSelectedGameSnapshot()).toBe(DEFAULT_SELECTED_GAME_ID);
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      DEFAULT_SELECTED_GAME_ID
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Close" })).toHaveFocus()
    );
  });
});
