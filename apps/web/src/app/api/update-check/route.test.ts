import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkForUpdate } from "../../../lib/updateCheck";
import { GET } from "./route";

vi.mock("../../../lib/updateCheck", () => ({
  checkForUpdate: vi.fn()
}));

const mockedCheckForUpdate = vi.mocked(checkForUpdate);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/update-check", () => {
  it("returns the checked release without caching it", async () => {
    mockedCheckForUpdate.mockResolvedValue({
      currentVersion: "0.3.2",
      latestVersion: "0.4.0",
      releaseUrl: "https://github.com/CTran10/CountSim/releases/tag/v0.4.0",
      updateAvailable: true
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      latestVersion: "0.4.0",
      updateAvailable: true
    });
  });

  it("returns a bounded error when GitHub is unavailable", async () => {
    mockedCheckForUpdate.mockRejectedValue(new Error("upstream details"));

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The update check could not be completed."
    });
  });
});
