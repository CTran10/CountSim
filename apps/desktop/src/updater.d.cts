export const UPDATE_CHECK_INTERVAL_MS: number;

export interface UpdateTimer {
  unref?: () => unknown;
}

export interface AutomaticUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): unknown;
  removeListener(event: "error", listener: (error: unknown) => void): unknown;
}

export interface StartAutomaticUpdatesOptions {
  autoUpdater: AutomaticUpdater;
  isPackaged: boolean;
  platform: string;
  schedule?: (callback: () => void, delayMs: number) => UpdateTimer;
  cancel?: (timer: UpdateTimer) => void;
  reportError?: (error: unknown) => void;
}

export function startAutomaticUpdates(
  options: StartAutomaticUpdatesOptions
): () => void;
