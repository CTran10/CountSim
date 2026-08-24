import { describe, expect, it, vi } from "vitest";

import {
  CURRENT_APP_VERSION,
  checkForUpdate,
  isNewerVersion
} from "./updateCheck";

function githubResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status
    })
  );
}

function nextPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch! + 1}`;
}

describe("update checking", () => {
  it("compares stable semantic versions without a dependency", () => {
    expect(isNewerVersion("v0.3.3", "0.3.2")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.99.99")).toBe(true);
    expect(isNewerVersion("0.3.2", "0.3.2")).toBe(false);
    expect(isNewerVersion("0.3.1", "0.3.2")).toBe(false);
    expect(() => isNewerVersion("latest", "0.3.2")).toThrow("semantic");
  });

  it("maps the latest published GitHub release into a safe update result", async () => {
    const latestVersion = nextPatchVersion(CURRENT_APP_VERSION);
    const fetchRelease = vi.fn(() =>
      githubResponse({
        html_url: `https://github.com/CTran10/CountSim/releases/tag/v${latestVersion}`,
        tag_name: `v${latestVersion}`
      })
    );

    await expect(checkForUpdate(fetchRelease)).resolves.toEqual({
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      releaseUrl: `https://github.com/CTran10/CountSim/releases/tag/v${latestVersion}`,
      updateAvailable: true
    });
    expect(fetchRelease).toHaveBeenCalledWith(
      "https://api.github.com/repos/CTran10/CountSim/releases/latest",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json"
        })
      })
    );
  });

  it("rejects upstream failures and untrusted release links", async () => {
    await expect(
      checkForUpdate(() => githubResponse({ message: "rate limited" }, 403))
    ).rejects.toThrow("status 403");
    await expect(
      checkForUpdate(() =>
        githubResponse({
          html_url: "https://example.com/download",
          tag_name: "v0.4.0"
        })
      )
    ).rejects.toThrow("expected GitHub repository");
  });
});
