// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EMPTY_APP_DATA, recordSession, writeAppData } from "./storage";
import { useAppData } from "./useAppData";

function SessionCount() {
  const data = useAppData();
  return (
    <output aria-label="Saved session count">{data.sessions.length}</output>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("useAppData", () => {
  it("reacts when another tab clears all local storage", () => {
    const data = recordSession(
      EMPTY_APP_DATA,
      {
        id: "cross-tab-session",
        completedAt: "2026-08-23T00:00:00.000Z",
        presetId: "lodge-dd",
        hands: 1,
        startingBankrollCents: 30_000,
        endingBankrollCents: 30_000,
        decisionQuality: 100,
        discipline: 100,
        intent: "discipline",
        intentScore: 100,
        skillResults: [],
        completionReason: "Hand limit reached",
        mistakes: [],
        replay: null
      },
      []
    );
    expect(writeAppData(window.localStorage, data)).toBe(true);
    render(<SessionCount />);
    expect(screen.getByLabelText("Saved session count")).toHaveTextContent("1");

    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(screen.getByLabelText("Saved session count")).toHaveTextContent("0");
  });
});
