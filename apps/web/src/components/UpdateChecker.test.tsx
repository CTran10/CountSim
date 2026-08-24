// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateChecker } from "./UpdateChecker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UpdateChecker", () => {
  it("links to a newer published release", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            currentVersion: "0.3.2",
            latestVersion: "0.4.0",
            releaseUrl:
              "https://github.com/CTran10/CountSim/releases/tag/v0.4.0",
            updateAvailable: true
          }),
          { status: 200 }
        )
      )
    );
    const user = userEvent.setup();
    render(<UpdateChecker />);

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(
      await screen.findByText("Version 0.4.0 is available.")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "View release" })).toHaveAttribute(
      "href",
      "https://github.com/CTran10/CountSim/releases/tag/v0.4.0"
    );
  });

  it("reports the current and failure states", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            currentVersion: "0.3.2",
            latestVersion: "0.3.2",
            releaseUrl:
              "https://github.com/CTran10/CountSim/releases/tag/v0.3.2",
            updateAvailable: false
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response("{}", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<UpdateChecker />);

    const button = screen.getByRole("button", { name: "Check for updates" });
    await user.click(button);
    expect(
      await screen.findByText("TrueEdge 0.3.2 is up to date.")
    ).toBeVisible();

    await user.click(button);
    expect(
      await screen.findByText("Could not check for updates. Try again.")
    ).toBeVisible();
  });
});
