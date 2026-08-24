// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_SESSION_CONFIG,
  applyCommand,
  createSession,
  exportReplay,
  selectTableView
} from "@trueedge/game-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  EMPTY_APP_DATA,
  recordSession,
  recordSkillAttempt,
  writeAppData,
  writeBrowserAppData
} from "../../lib/storage";
import { ReviewView } from "./ReviewView";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ReviewView", () => {
  it("shows the selected intent, per-session skills, and persisted replay", async () => {
    const initial = createSession(DEFAULT_SESSION_CONFIG);
    const wagered = applyCommand(initial, {
      type: "place_bet",
      amountCents: 500
    });
    if (!wagered.ok) throw new Error(wagered.error);
    const dealt = applyCommand(wagered.state, { type: "deal" });
    if (!dealt.ok) throw new Error(dealt.error);
    if (dealt.state.phase !== "player") {
      throw new Error("Review fixture requires a player decision.");
    }
    const decisionView = selectTableView(dealt.state);
    const settled = applyCommand(dealt.state, { type: "stand" });
    if (!settled.ok) throw new Error(settled.error);
    const replay = {
      ...exportReplay(settled.state),
      commandElapsedMs: [100, 300, 1_300]
    };
    let data = recordSession(
      EMPTY_APP_DATA,
      {
        id: "review-session",
        completedAt: "2026-08-23T00:00:00.000Z",
        presetId: "lodge-dd",
        hands: 1,
        startingBankrollCents: 30_000,
        endingBankrollCents: 30_000,
        decisionQuality: 50,
        discipline: 100,
        intent: "basic_strategy",
        intentScore: 50,
        skillResults: [{ id: "basic_strategy", attempts: 2, correct: 1 }],
        completionReason: "Hand limit reached",
        mistakes: [
          {
            handNumber: 1,
            situation: "16 against 10",
            actual: "hit",
            expected: "stand",
            category: "basic_strategy",
            replayCommandIndex: 2
          }
        ],
        replay
      },
      [{ id: "basic_strategy", attempts: 2, correct: 1 }]
    );
    data = recordSkillAttempt(data, "basic_strategy", true);
    expect(writeAppData(window.localStorage, data)).toBe(true);

    const user = userEvent.setup();
    render(<ReviewView />);

    expect(
      within(screen.getByLabelText("Session scorecard")).getByText(
        "Basic strategy"
      ).nextSibling
    ).toHaveTextContent("50%");
    expect(screen.getByText("1/2 · 50%")).toBeInTheDocument();
    expect(
      screen.getByText("Verified hand and decision timeline")
    ).toBeVisible();
    expect(
      screen.getByText("Average decision time").nextSibling
    ).toHaveTextContent("1s");
    await user.click(screen.getByRole("button", { name: "Replay point" }));
    expect(screen.getByRole("heading", { name: "Shoe replay" })).toHaveFocus();
    expect(
      screen.getByRole("combobox", { name: "Review checkpoint" })
    ).toHaveValue("0");
    const dealer = within(screen.getByLabelText("Dealer replay cards"));
    expect(
      dealer.getAllByText(new RegExp(decisionView.dealerCards[0]!.rank)).length
    ).toBeGreaterThan(0);
    const player = within(screen.getByLabelText("Player replay cards"));
    for (const card of decisionView.playerCards) {
      expect(player.getAllByText(new RegExp(card.rank)).length).toBeGreaterThan(
        0
      );
    }
    expect(
      screen.getByText(
        `${decisionView.rules.decks}D · ${decisionView.rules.blackjackPayout} · ${decisionView.rules.dealerSoft17} · DAS`
      )
    ).toBeVisible();
    expect(screen.getByText(decisionView.deviationProfileId!)).toBeVisible();
    const scored = within(screen.getByLabelText("Scored decision"));
    expect(scored.getByText("hit")).toBeVisible();
    expect(scored.getByText("stand")).toBeVisible();

    const replacement = recordSession(
      data,
      {
        id: "newest-review-session",
        completedAt: "2026-08-23T00:01:00.000Z",
        presetId: "lodge-dd",
        hands: 1,
        startingBankrollCents: 30_000,
        endingBankrollCents: 30_500,
        decisionQuality: 100,
        discipline: 100,
        intent: "discipline",
        intentScore: 100,
        skillResults: [],
        completionReason: "Hand limit reached",
        mistakes: [],
        replay
      },
      []
    );
    expect(writeBrowserAppData(replacement)).toBe(true);

    expect(
      await screen.findByRole("combobox", { name: "Review checkpoint" })
    ).toHaveValue("1");
    expect(screen.queryByLabelText("Scored decision")).not.toBeInTheDocument();
  });
});
