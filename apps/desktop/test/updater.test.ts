import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import {
  UPDATE_CHECK_INTERVAL_MS,
  startAutomaticUpdates,
  type AutomaticUpdater
} from "../src/updater.cjs";

class FakeUpdater extends EventEmitter implements AutomaticUpdater {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => null);
}

describe("desktop automatic updates", () => {
  it("stays inactive for development builds", () => {
    const autoUpdater = new FakeUpdater();
    const schedule = vi.fn();

    startAutomaticUpdates({
      autoUpdater,
      isPackaged: false,
      platform: "darwin",
      schedule
    });

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(autoUpdater.autoDownload).toBe(false);
  });

  it.each(["win32", "linux"])(
    "stays inactive for packaged %s builds",
    (platform) => {
      const autoUpdater = new FakeUpdater();
      const schedule = vi.fn();

      startAutomaticUpdates({
        autoUpdater,
        isPackaged: true,
        platform,
        schedule
      });

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(schedule).not.toHaveBeenCalled();
    }
  );

  it("downloads silently, checks periodically, and installs on app quit", () => {
    const autoUpdater = new FakeUpdater();
    const timer = { unref: vi.fn() };
    let scheduledCheck: (() => void) | undefined;
    const schedule = vi.fn((callback: () => void, delayMs: number) => {
      scheduledCheck = callback;
      expect(delayMs).toBe(UPDATE_CHECK_INTERVAL_MS);
      return timer;
    });
    const cancel = vi.fn();

    const stop = startAutomaticUpdates({
      autoUpdater,
      isPackaged: true,
      platform: "darwin",
      schedule,
      cancel
    });

    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(timer.unref).toHaveBeenCalledOnce();

    scheduledCheck?.();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);

    stop();
    stop();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("reports updater failures once and removes the listener on stop", async () => {
    const autoUpdater = new FakeUpdater();
    const error = new Error("offline");
    autoUpdater.checkForUpdates.mockRejectedValue(error);
    const reportError = vi.fn();

    const stop = startAutomaticUpdates({
      autoUpdater,
      isPackaged: true,
      platform: "darwin",
      schedule: () => ({}),
      cancel: vi.fn(),
      reportError
    });
    autoUpdater.emit("error", error);
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error);
    stop();
    expect(autoUpdater.listenerCount("error")).toBe(0);
  });
});
