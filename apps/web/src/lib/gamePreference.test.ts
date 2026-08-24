// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SELECTED_GAME_ID,
  getSelectedGameSnapshot,
  SELECTED_GAME_STORAGE_KEY,
  subscribeToSelectedGame,
  updateSelectedGameId
} from "./gamePreference";
import { EMPTY_APP_DATA, writeBrowserAppData } from "./storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("gamePreference", () => {
  it("defaults safely and persists a valid selected game", () => {
    expect(getSelectedGameSnapshot()).toBe(DEFAULT_SELECTED_GAME_ID);

    updateSelectedGameId("ballys-north-dd");

    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      "ballys-north-dd"
    );
    expect(getSelectedGameSnapshot()).toBe("ballys-north-dd");
  });

  it("notifies subscribers and rejects unsafe or unknown ids", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToSelectedGame(onChange);

    updateSelectedGameId("../../unsafe");

    expect(getSelectedGameSnapshot()).toBe(DEFAULT_SELECTED_GAME_ID);
    expect(onChange).toHaveBeenCalledOnce();

    updateSelectedGameId("missing-game");

    expect(getSelectedGameSnapshot()).toBe(DEFAULT_SELECTED_GAME_ID);
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("accepts a saved custom game and rejects it after deletion", () => {
    const customGame = {
      id: "custom-user-local-game",
      name: "Local game",
      penetration: { mode: "fixed" as const, value: 0.75 },
      shuffle: "perfect_random" as const,
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
    };
    expect(
      writeBrowserAppData({
        ...EMPTY_APP_DATA,
        customGames: [customGame]
      })
    ).toBe(true);

    updateSelectedGameId(customGame.id);
    expect(getSelectedGameSnapshot()).toBe(customGame.id);

    const onChange = vi.fn();
    const unsubscribe = subscribeToSelectedGame(onChange);
    expect(writeBrowserAppData(EMPTY_APP_DATA)).toBe(true);
    expect(getSelectedGameSnapshot()).toBe(DEFAULT_SELECTED_GAME_ID);
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
