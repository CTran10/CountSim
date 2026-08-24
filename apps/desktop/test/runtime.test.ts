import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  LOCAL_SERVER_PORT,
  RUNTIME_MARKER,
  isAllowedExternalUrl,
  isAppUrl,
  isRuntimeResponse,
  resolveServerEntry
} from "../src/runtime.cjs";

describe("desktop runtime boundaries", () => {
  it("finds both flat and monorepo standalone server layouts", () => {
    expect(
      resolveServerEntry("/bundle", (candidate) =>
        candidate.endsWith(path.join("bundle", "server.js"))
      )
    ).toBe(path.join("/bundle", "server.js"));
    expect(
      resolveServerEntry("/bundle", (candidate) =>
        candidate.endsWith(path.join("apps", "web", "server.js"))
      )
    ).toBe(path.join("/bundle", "apps", "web", "server.js"));
    expect(() => resolveServerEntry("/missing", () => false)).toThrow(
      "could not be found"
    );
  });

  it("keeps app navigation local and opens only HTTPS externally", () => {
    const origin = "http://127.0.0.1:43123";
    expect(isAppUrl(`${origin}/games`, origin)).toBe(true);
    expect(isAppUrl("https://example.com", origin)).toBe(false);
    expect(isAllowedExternalUrl("https://example.com/rules")).toBe(true);
    expect(isAllowedExternalUrl("http://example.com")).toBe(false);
    expect(isAllowedExternalUrl("file:///tmp/example")).toBe(false);
    expect(isAllowedExternalUrl("not a URL")).toBe(false);
  });

  it("uses a stable local origin and verifies its server marker", () => {
    expect(LOCAL_SERVER_PORT).toBe(47_831);
    expect(isRuntimeResponse(200, RUNTIME_MARKER)).toBe(true);
    expect(isRuntimeResponse(503, RUNTIME_MARKER)).toBe(false);
    expect(isRuntimeResponse(200, "another-service")).toBe(false);
  });
});
