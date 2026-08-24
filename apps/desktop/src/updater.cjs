const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function defaultReportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Automatic update failed: ${message}`);
}

function startAutomaticUpdates({
  autoUpdater,
  isPackaged,
  platform,
  schedule = setInterval,
  cancel = clearInterval,
  reportError = defaultReportError
}) {
  if (!isPackaged || platform !== "darwin") return () => {};

  const reportedErrors = new WeakSet();
  const reportOnce = (error) => {
    if (
      (typeof error === "object" && error !== null) ||
      typeof error === "function"
    ) {
      if (reportedErrors.has(error)) return;
      reportedErrors.add(error);
    }
    reportError(error);
  };
  const checkForUpdate = () => {
    try {
      void autoUpdater.checkForUpdates().catch(reportOnce);
    } catch (error) {
      reportOnce(error);
    }
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", reportOnce);
  checkForUpdate();

  const timer = schedule(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  timer.unref?.();
  let stopped = false;

  return () => {
    if (stopped) return;
    stopped = true;
    cancel(timer);
    autoUpdater.removeListener("error", reportOnce);
  };
}

module.exports = {
  UPDATE_CHECK_INTERVAL_MS,
  startAutomaticUpdates
};
