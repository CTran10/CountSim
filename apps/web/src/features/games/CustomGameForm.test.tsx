// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { readAppData } from "../../lib/storage";
import { CustomGameForm } from "./CustomGameForm";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("CustomGameForm", () => {
  it("stores the no-DAS double-deck deviation profile explicitly", async () => {
    const user = userEvent.setup();
    render(<CustomGameForm />);

    await user.type(
      screen.getByRole("textbox", { name: "Game name" }),
      "No DAS DD"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Decks" }),
      "2"
    );
    await user.click(screen.getByRole("checkbox", { name: "DAS" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Hi-Lo deviation profile" }),
      "hilo-dd-h17-no-das"
    );
    await user.click(screen.getByRole("button", { name: "Save custom game" }));

    expect(readAppData(window.localStorage).customGames[0]).toMatchObject({
      name: "No DAS DD",
      rules: {
        decks: 2,
        doubleAfterSplit: false,
        deviationProfile: "hilo-dd-h17-no-das"
      }
    });
  });

  it("allows basic-strategy-only training for otherwise indexed rules", async () => {
    const user = userEvent.setup();
    render(<CustomGameForm />);

    await user.type(
      screen.getByRole("textbox", { name: "Game name" }),
      "Basic Only Shoe"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Hi-Lo deviation profile" }),
      "basic-strategy-only"
    );
    await user.click(screen.getByRole("button", { name: "Save custom game" }));

    expect(readAppData(window.localStorage).customGames[0]).toMatchObject({
      name: "Basic Only Shoe",
      rules: { deviationProfile: "basic-strategy-only" }
    });
  });

  it("prefills and updates an existing game without changing its id", async () => {
    const user = userEvent.setup();
    render(
      <CustomGameForm
        initialGame={{
          id: "custom-house-game",
          name: "House Game",
          penetration: { mode: "fixed", value: 0.7 },
          shuffle: "simulated_hand",
          rules: {
            decks: 2,
            blackjackPayout: "3:2",
            dealerSoft17: "H17",
            doubleRule: "any_two",
            doubleAfterSplit: true,
            resplitAces: false,
            hitSplitAces: false,
            doubleSplitAces: false,
            surrender: "none",
            maxSplitHands: 4,
            dealerPeek: true,
            burnCard: false,
            deviationProfile: "hilo-dd-h17-das"
          }
        }}
      />
    );

    const name = screen.getByRole("textbox", { name: "Game name" });
    expect(name).toHaveValue("House Game");
    expect(screen.getByRole("combobox", { name: "Decks" })).toHaveValue("2");
    expect(
      screen.getByRole("combobox", { name: "Shuffle behavior" })
    ).toHaveValue("simulated_hand");

    await user.clear(name);
    await user.type(name, "Updated House Game");
    await user.click(screen.getByRole("button", { name: "Save custom game" }));

    expect(readAppData(window.localStorage).customGames[0]).toMatchObject({
      id: "custom-house-game",
      name: "Updated House Game"
    });
  });
});
