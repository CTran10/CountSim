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
});
