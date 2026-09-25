import { createRequire } from "module";
import { app } from "electron";
import { AutoUpdaterService, type UpdaterPort } from "./auto-updater";
import type { UpdateStatus } from "../../shared/updater";

export interface UpdaterHost {
  service: AutoUpdaterService;
  init: () => void;
  check: () => Promise<UpdateStatus>;
  download: () => Promise<UpdateStatus>;
  install: () => boolean;
  getStatus: () => UpdateStatus;
  onStatus: (listener: (status: UpdateStatus) => void) => () => void;
}

export function createUpdaterHost(currentVersion: string = app.getVersion()): UpdaterHost {
  const listeners = new Set<(status: UpdateStatus) => void>();
  const emit = (status: UpdateStatus): void => {
    for (const listener of listeners) listener(status);
  };

  const service = new AutoUpdaterService({
    updater: loadUpdaterPort(),
    isPackaged: app.isPackaged,
    currentVersion,
    emit,
  });

  return {
    service,
    init: () => service.init(),
    check: () => service.check(),
    download: () => service.download(),
    install: () => service.install(),
    getStatus: () => service.getStatus(),
    onStatus: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function loadUpdaterPort(): UpdaterPort {
  try {
    const require = createRequire(import.meta.url);
    return require("electron-updater").autoUpdater as UpdaterPort;
  } catch {
    return noopUpdater();
  }
}

function noopUpdater(): UpdaterPort {
  return {
    autoDownload: false,
    on: () => undefined,
    checkForUpdates: async () => undefined,
    downloadUpdate: async () => undefined,
    quitAndInstall: () => undefined,
  };
}
