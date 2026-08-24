// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SESSION_CONFIG } from "@trueedge/game-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readAppData } from "../../lib/storage";
import { BlackjackTable } from "./BlackjackTable";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("BlackjackTable", () => {
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

    await user.click(screen.getByRole("button", { name: "Bet $25" }));
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
    expect(screen.getByText("Cards seen").nextSibling).toHaveTextContent("3");
  });

  it("completes a round, announces the result, and exports its replay", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $25" }));
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

  it("supports the documented deal and stand keyboard shortcuts", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    await user.keyboard("{Alt>}d{/Alt}");
    expect(screen.getAllByTestId("player-card")).toHaveLength(2);
    await user.keyboard("{Alt>}s{/Alt}");
    expect(screen.getByText("Round complete")).toBeInTheDocument();
  });

  it("scopes shortcuts to the table controls", async () => {
    const user = userEvent.setup();
    render(<BlackjackTable seed={785390425} />);

    await user.click(screen.getByRole("button", { name: "Bet $5" }));
    screen.getByRole("button", { name: "End at this round" }).focus();
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
    expect(screen.getByRole("button", { name: "Bet $5" })).toBeDisabled();
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

    expect(
      screen.getByRole("heading", { name: "Decision feedback" })
    ).toBeVisible();
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

    expect(
      await screen.findByText(
        "Session finished, but browser progress could not be saved."
      )
    ).toBeVisible();
  });
});
