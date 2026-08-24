// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_SESSION_CONFIG,
  applyCommand,
  createSession
} from "@trueedge/game-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SELECTED_GAME_STORAGE_KEY } from "../../lib/gamePreference";
import { readAppData } from "../../lib/storage";
import { BlackjackTable } from "./BlackjackTable";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

function findAutoSettledBlackjackSeed(): number {
  for (let seed = 0; seed <= 2_000; seed += 1) {
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = applyCommand(state, {
      type: "place_bet",
      amountCents: 500
    }).state;
    state = applyCommand(state, { type: "deal" }).state;
    if (state.round?.result?.outcome === "blackjack") return seed;
  }
  throw new Error("No deterministic blackjack fixture was found.");
}

function findStandSettledSeed(result: "win" | "loss"): number {
  for (let seed = 0; seed <= 2_000; seed += 1) {
    let state = createSession({ ...DEFAULT_SESSION_CONFIG, seed });
    state = applyCommand(state, {
      type: "place_bet",
      amountCents: 500
    }).state;
    state = applyCommand(state, { type: "deal" }).state;
    if (state.phase !== "player") continue;
    state = applyCommand(state, { type: "stand" }).state;
    const profitCents = state.round?.result?.profitCents;
    if (
      profitCents !== undefined &&
      (result === "win" ? profitCents > 0 : profitCents < 0)
    ) {
      return seed;
    }
  }
  throw new Error(`No deterministic ${result} fixture was found.`);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  pushMock.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("BlackjackTable", () => {
  it("offers and persists game presets from the table drawer without replacing the active session", async () => {
    const user = userEvent.setup();
    render(
      <BlackjackTable
        config={{ ...DEFAULT_SESSION_CONFIG, presetId: "lodge-6d" }}
        presetLabel="The Lodge Six Deck"
        seed={DEFAULT_SESSION_CONFIG.seed}
      />
    );

    const preset = screen.getByRole("combobox", { name: "Game preset" });
    expect(preset).toHaveValue("lodge-6d");
    expect(within(preset).getAllByRole("option")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Set up game" })).toBeVisible();
    expect(preset.closest("form")).toHaveAttribute("action", "/setup");

    await user.selectOptions(preset, "ballys-north-dd");
    expect(window.localStorage.getItem(SELECTED_GAME_STORAGE_KEY)).toBe(
      "ballys-north-dd"
    );
  });

  it("shows and focuses insurance between the hands", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="observation" seed={14} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    const prompt = screen.getByRole("group", { name: "Insurance decision" });
    const controls = screen.getByRole("region", { name: "Table controls" });
    expect(prompt).toBeVisible();
    expect(prompt).toHaveFocus();
    expect(
      prompt.compareDocumentPosition(controls) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("starts with honest virtual-money labeling and requires a wager", () => {
    render(<BlackjackTable seed={785390425} />);

    expect(screen.getByText("Practice bankroll")).toBeInTheDocument();
    expect(
      screen.getByText("Virtual funds only.", { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deal" })).toBeDisabled();
  });

  it("deals a deterministic hand and exposes only legal actions", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $20" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getAllByTestId("player-card")).toHaveLength(2);
    expect(screen.getByTestId("dealer-hole-card")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("player-card").map((card) => card.dataset.dealOrder)
    ).toEqual(["0", "2"]);
    expect(screen.getByTestId("dealer-card")).toHaveAttribute(
      "data-deal-order",
      "1"
    );
    expect(screen.getByTestId("dealer-hole-card")).toHaveAttribute(
      "data-deal-order",
      "3"
    );
    expect(screen.getByRole("button", { name: "Hit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Stand" })).toBeEnabled();
    expect(screen.getByLabelText("Count snapshot")).toHaveTextContent(
      "True count"
    );
  });

  it("completes a round, announces the result, and exports its replay", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $20" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    expect(screen.getByText("Round complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hit" })).toBeDisabled();
    const disclosure = screen.getByRole("button", { name: "Export replay" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await user.click(disclosure);
    expect(screen.getByRole("button", { name: "Hide replay" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const replay = screen.getByRole("textbox", {
      name: "Exported replay data"
    });
    expect((replay as HTMLTextAreaElement).value).toContain(
      '"schemaVersion": 3'
    );
    await user.click(screen.getByRole("button", { name: "Hide replay" }));
    expect(document.getElementById("trueedge-replay-data")).not.toBeVisible();
  });

  it("ends the current session, saves it, and opens review", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="decision" seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));
    expect(readAppData(window.localStorage).sessions).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "End session and review" })
    );

    expect(readAppData(window.localStorage).sessions[0]).toMatchObject({
      hands: 1,
      completionReason: "Ended by player"
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Open session review" })
    );

    expect(pushMock).toHaveBeenCalledWith("/review");
  });

  it("outlines winning cards in green and congratulates the player", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={findAutoSettledBlackjackSeed()} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getAllByTestId("player-card")).not.toHaveLength(0);
    for (const card of screen.getAllByTestId("player-card")) {
      expect(card).toHaveAttribute("data-hand-result", "win");
    }
    expect(screen.getByTestId("winning-hand-celebration")).toHaveTextContent(
      "Nice hand"
    );
  });

  it("outlines losing cards in red", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={findStandSettledSeed("loss")} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    for (const card of screen.getAllByTestId("player-card")) {
      expect(card).toHaveAttribute("data-hand-result", "loss");
    }
  });

  it("celebrates a winning session before opening review", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={findAutoSettledBlackjackSeed()} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(
      screen.getByRole("button", { name: "End session and review" })
    );

    const dialog = screen.getByRole("dialog", {
      name: "Nice work. You finished up."
    });
    expect(dialog).toHaveAttribute("data-session-result", "win");
    expect(dialog).toHaveTextContent("Winning session");
  });

  it("shows the stop-loss roast when the session gets rinsed", async () => {
    const user = userEvent.setup();
    const seed = findStandSettledSeed("loss");
    render(
      <BlackjackTable
        config={{
          ...DEFAULT_SESSION_CONFIG,
          seed,
          limits: {
            ...DEFAULT_SESSION_CONFIG.limits,
            startingBankrollCents: 1_000,
            maxBetCents: 500,
            maxLossCents: 500
          }
        }}
        seed={seed}
      />
    );

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    const dialog = screen.getByRole("dialog", { name: "You got rinsed." });
    expect(dialog).toHaveAttribute("data-session-result", "stop-loss");
    expect(dialog).toHaveTextContent("The stop-loss had to drag you off");
  });

  it("shows the harsher roast when the practice bankroll hits zero", async () => {
    const user = userEvent.setup();
    const seed = findStandSettledSeed("loss");
    render(
      <BlackjackTable
        config={{
          ...DEFAULT_SESSION_CONFIG,
          seed,
          limits: {
            ...DEFAULT_SESSION_CONFIG.limits,
            startingBankrollCents: 500,
            maxBetCents: 500,
            maxLossCents: 500
          }
        }}
        seed={seed}
      />
    );

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    const dialog = screen.getByRole("dialog", {
      name: "You got absolutely zero'd."
    });
    expect(dialog).toHaveAttribute("data-session-result", "bankroll-depleted");
    expect(dialog).toHaveTextContent("it repossessed you");
  });

  it("keeps the previous base wager selected for the next Deal", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $20" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    expect(screen.getByRole("button", { name: "Bet $20" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Deal" })).toBeEnabled();
    await user.keyboard("{Alt>}d{/Alt}");

    expect(screen.getAllByTestId("player-card")).toHaveLength(2);
    expect(
      within(screen.getByText("Wager").parentElement!).getByText("$20")
    ).toBeVisible();
    expect(
      screen.getByText("Cards dealt. Make the next decision.")
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Export replay" }));
    const replay = JSON.parse(
      screen.getByRole<HTMLTextAreaElement>("textbox", {
        name: "Exported replay data"
      }).value
    ) as { successfulCommands: { type: string }[] };
    expect(replay.successfulCommands.map((command) => command.type)).toEqual([
      "place_bet",
      "deal",
      "stand",
      "place_bet",
      "deal"
    ]);
  });

  it("shows the retained wager after an automatically settled blackjack", async () => {
    const user = userEvent.setup();
    render(
      <BlackjackTable
        mode="observation"
        seed={findAutoSettledBlackjackSeed()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getByText("Round complete")).toBeVisible();
    expect(screen.getByLabelText("Decision explanation")).toHaveTextContent(
      "Deal the hand"
    );
    expect(screen.getByLabelText("Decision explanation")).toHaveTextContent(
      "$5 is selected. Deal when ready."
    );
    expect(screen.getByRole("button", { name: "Deal" })).toBeEnabled();
  });

  it("supports the documented deal and stand keyboard shortcuts", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.keyboard("{Alt>}d{/Alt}");
    expect(screen.getAllByTestId("player-card")).toHaveLength(2);
    await user.keyboard("{Alt>}s{/Alt}");
    expect(screen.getByText("Round complete")).toBeInTheDocument();
  });

  it("handles macOS Option shortcuts by their physical key code", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    const wager = screen.getByRole("button", { name: "Bet $5" });
    await user.click(wager);
    fireEvent.keyDown(wager, {
      altKey: true,
      code: "KeyD",
      key: "∂"
    });

    expect(screen.getAllByTestId("player-card")).toHaveLength(2);
  });

  it("scopes shortcuts to the table controls", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    screen.getByRole("button", { name: "Export replay" }).focus();
    await user.keyboard("{Alt>}d{/Alt}");

    expect(screen.queryAllByTestId("player-card")).toHaveLength(0);
  });

  it("clears decision feedback when a keyboard shortcut starts a round", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="decision" seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.keyboard("{Alt>}d{/Alt}");
    await user.click(screen.getByRole("button", { name: "Stand" }));
    expect(screen.getByLabelText("Decision feedback log")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.keyboard("{Alt>}d{/Alt}");

    expect(
      screen.queryByLabelText("Decision feedback log")
    ).not.toBeInTheDocument();
  });

  it("keeps observation analysis aligned with the current decision", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="observation" seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Hit" }));

    expect(screen.getByLabelText("Decision explanation")).not.toHaveTextContent(
      /Correct:|You chose/u
    );
  });

  it("shows actionable decision and wager guidance without mode chrome", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="observation" seed={785390425} />);

    expect(screen.queryByText("Live analysis")).not.toBeInTheDocument();
    expect(screen.queryByText("observation mode")).not.toBeInTheDocument();
    expect(screen.getByText("Decision guide")).toBeInTheDocument();
    expect(screen.getByLabelText("Wager guidance")).toHaveTextContent(
      "Move to 2 units at TC +1."
    );
    expect(screen.getByLabelText("Hi-Lo card values")).toHaveTextContent(
      "+12 3 4 5 6"
    );
    expect(screen.getByLabelText("Hi-Lo card values")).toHaveTextContent(
      "-110 J Q K A"
    );

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getByText("Next decision")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Stand" })).toBeVisible();
    expect(screen.getByLabelText("Count snapshot")).toHaveTextContent(
      "Decks left"
    );
    for (const removedLabel of [
      "Raw true count",
      "Convention",
      "Last card to RC",
      "Discard tray"
    ]) {
      expect(screen.queryByText(removedLabel)).not.toBeInTheDocument();
    }
  });

  it("maps a positive true count to the shared unit ramp", async () => {
    const user = userEvent.setup();
    const config = {
      ...DEFAULT_SESSION_CONFIG,
      seed: 3,
      deviationProfileId: "basic-strategy-only",
      rules: {
        ...DEFAULT_SESSION_CONFIG.rules,
        decks: 1 as const
      }
    };
    render(<BlackjackTable config={config} mode="observation" seed={3} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getByLabelText("Wager guidance")).toHaveTextContent(
      "Next hand: 2 units ($10)"
    );
    expect(screen.getByLabelText("Wager guidance")).toHaveTextContent(
      "Move to 4 units at TC +2."
    );
  });

  it("surfaces the insurance decision and its count trigger", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="observation" seed={14} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    expect(screen.getByText("Insurance decision")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Decline insurance" })
    ).toBeVisible();
    expect(screen.getByText("Index trigger").nextSibling).toHaveTextContent(
      "TC +3"
    );
  });

  it("flags a basic-strategy miss immediately in Play mode", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="play" seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Hit" }));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Basic strategy miss");
    expect(notice).toHaveTextContent("You chose hit. Expected stand.");
  });

  it("flags a count-based deviation miss with the indexed action", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="play" seed={72} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Hit" }));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Deviation miss");
    expect(notice).toHaveTextContent("You chose hit. Expected stand.");
    expect(notice).toHaveTextContent("index 0");
  });

  it("flags a wrong insurance choice immediately", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="play" seed={14} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Take insurance" }));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Insurance miss");
    expect(notice).toHaveTextContent("You chose insurance. Expected decline.");
  });

  it("resets the visible session and replay when keyed to a new seed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BlackjackTable key={1} seed={1} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    expect(screen.getAllByTestId("player-card")).toHaveLength(2);

    rerender(<BlackjackTable key={2} seed={2} />);
    expect(screen.getByText("2", { exact: true })).toBeInTheDocument();
    expect(screen.queryAllByTestId("player-card")).toHaveLength(0);
    expect(screen.getByText("Choose a virtual wager to begin.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Export replay" }));
    const replay = screen.getByRole("textbox", {
      name: "Exported replay data"
    }) as HTMLTextAreaElement;
    expect(JSON.parse(replay.value)).toMatchObject({
      config: { seed: 2 },
      successfulCommands: []
    });
  });

  it("enforces the configured duration without resetting on interaction", () => {
    vi.useFakeTimers();
    render(
      <BlackjackTable
        config={{
          ...DEFAULT_SESSION_CONFIG,
          seed: 44,
          limits: {
            ...DEFAULT_SESSION_CONFIG.limits,
            maxDurationSeconds: 1
          }
        }}
        seed={44}
      />
    );

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Duration limit reached")).toBeInTheDocument();
    expect(
      screen
        .getByTestId("trueedge-table")
        .querySelector('[aria-label="Virtual wager choices"] button')
    ).toBeDisabled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("retains repeated same-seed sessions as separate history", async () => {
    const config = {
      ...DEFAULT_SESSION_CONFIG,
      seed: 785390425,
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        handLimit: 1,
        maxHands: 1
      }
    };
    const firstUser = userEvent.setup();
    const first = render(<BlackjackTable config={config} seed={config.seed} />);
    await firstUser.click(screen.getByRole("button", { name: "Bet $5" }));
    await firstUser.click(screen.getByRole("button", { name: "Deal" }));
    await firstUser.click(screen.getByRole("button", { name: "Stand" }));
    expect(readAppData(window.localStorage).sessions).toHaveLength(1);
    first.unmount();

    const secondUser = userEvent.setup();
    render(<BlackjackTable config={config} seed={config.seed} />);
    await secondUser.click(screen.getByRole("button", { name: "Bet $5" }));
    await secondUser.click(screen.getByRole("button", { name: "Deal" }));
    await secondUser.click(screen.getByRole("button", { name: "Stand" }));

    const sessions = readAppData(window.localStorage).sessions;
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => session.id)).size).toBe(2);
  });

  it.each(["play", "practice", "decision", "observation"] as const)(
    "applies the documented mastery policy in %s mode",
    async (mode) => {
      const user = userEvent.setup();
      const config = {
        ...DEFAULT_SESSION_CONFIG,
        seed: 785390425,
        limits: {
          ...DEFAULT_SESSION_CONFIG.limits,
          handLimit: 1,
          maxHands: 1
        }
      };
      render(<BlackjackTable config={config} mode={mode} seed={config.seed} />);

      expect(
        screen.queryByRole("textbox", { name: "Running count" })
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Bet $5" }));
      await user.click(screen.getByRole("button", { name: "Deal" }));
      if (mode === "practice") {
        expect(
          screen.getByRole("textbox", { name: "Running count" })
        ).toBeInTheDocument();
      } else {
        expect(
          screen.queryByRole("textbox", { name: "Running count" })
        ).not.toBeInTheDocument();
      }
      await user.click(screen.getByRole("button", { name: "Stand" }));

      const stored = readAppData(window.localStorage).sessions[0];
      expect(stored).toBeDefined();
      const scoredActions = stored!.skillResults
        .filter(
          (skill) => skill.id === "basic_strategy" || skill.id === "deviations"
        )
        .reduce((sum, skill) => sum + skill.attempts, 0);
      expect(scoredActions).toBe(mode === "observation" ? 0 : 1);
      if (mode === "observation") {
        expect(stored).toMatchObject({
          intent: "discipline",
          intentScore: 100
        });
      }
    }
  );

  it("does not persist an impossible deviation intent for incompatible rules", async () => {
    const user = userEvent.setup();
    const config = {
      ...DEFAULT_SESSION_CONFIG,
      deviationProfileId: "hi-lo-dd-h17",
      practiceIntent: "deviation" as const,
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        handLimit: 1,
        maxHands: 1
      }
    };
    render(
      <BlackjackTable config={config} mode="decision" seed={config.seed} />
    );

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    expect(readAppData(window.localStorage).sessions[0]?.intent).toBe(
      "basic_strategy"
    );
  });

  it("reveals decision feedback after a choice without exposing count prompts", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="decision" seed={785390425} />);

    expect(
      screen.queryByRole("textbox", { name: "Running count" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Hit" }));

    expect(screen.getByText("Last decision")).toBeVisible();
    expect(
      within(screen.getByLabelText("Decision feedback log")).getAllByRole(
        "listitem"
      )
    ).toHaveLength(1);
  });

  it("rejects blank and repeated count submissions at one card checkpoint", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable mode="practice" seed={785390425} />);

    expect(
      screen.queryByRole("textbox", { name: "Running count" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));

    await user.click(screen.getAllByRole("button", { name: "Check" })[0]!);
    expect(
      screen.getByText("Enter an answer before checking it.")
    ).toBeVisible();

    const input = screen.getByRole("textbox", { name: "Running count" });
    await user.type(input, "0");
    await user.click(screen.getAllByRole("button", { name: "Check" })[0]!);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Checked" })).toBeDisabled();
  });

  it("surfaces a nonfatal session persistence failure", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const user = userEvent.setup();
    const config = {
      ...DEFAULT_SESSION_CONFIG,
      limits: {
        ...DEFAULT_SESSION_CONFIG.limits,
        handLimit: 1,
        maxHands: 1
      }
    };
    render(<BlackjackTable config={config} seed={config.seed} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.click(screen.getByRole("button", { name: "Deal" }));
    await user.click(screen.getByRole("button", { name: "Stand" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Session finished, but browser progress could not be saved."
    );
  });
});
