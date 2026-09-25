import type { UpdateStatus } from "../../shared/updater";

export interface UpdateInfo {
  version: string;
}

export interface ProgressInfo {
  percent: number;
}

export interface UpdaterPort {
  autoDownload: boolean;
  on(event: "checking-for-update", listener: () => void): unknown;
  on(event: "update-available", listener: (info: UpdateInfo) => void): unknown;
  on(event: "update-not-available", listener: () => void): unknown;
  on(event: "download-progress", listener: (progress: ProgressInfo) => void): unknown;
  on(event: "update-downloaded", listener: (info: UpdateInfo) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
}

export interface AutoUpdaterDeps {
  updater: UpdaterPort;
  isPackaged: boolean;
  currentVersion: string;
  emit: (status: UpdateStatus) => void;
  now?: () => number;
}

export class AutoUpdaterService {
  private status: UpdateStatus;
  private readonly now: () => number;

  constructor(private readonly deps: AutoUpdaterDeps) {
    this.now = deps.now ?? Date.now;
    this.status = { stage: "idle", currentVersion: deps.currentVersion, checkedAt: this.now() };
  }

  init(): void {
    const { updater, isPackaged } = this.deps;
    updater.autoDownload = true;

    updater.on("checking-for-update", () => this.set({ stage: "checking" }));
    updater.on("update-available", (info) => this.set({ stage: "available", version: info.version }));
    updater.on("update-not-available", () => this.set({ stage: "not-available" }));
    updater.on("download-progress", (progress) => this.set({ stage: "downloading", percent: Math.round(progress.percent) }));
    updater.on("update-downloaded", (info) => this.set({ stage: "downloaded", version: info.version }));
    updater.on("error", (error) => this.set({ stage: "error", message: error.message }));

    if (!isPackaged) {
      this.set({ stage: "disabled", message: "dev build: auto-update deshabilitado" });
    }
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  async check(): Promise<UpdateStatus> {
    if (!this.deps.isPackaged) {
      this.set({ stage: "disabled", message: "dev build: auto-update deshabilitado" });
      return this.status;
    }
    try {
      await this.deps.updater.checkForUpdates();
    } catch (error) {
      this.set({ stage: "error", message: error instanceof Error ? error.message : String(error) });
    }
    return this.status;
  }

  async download(): Promise<UpdateStatus> {
    if (!this.deps.isPackaged) return this.status;
    try {
      await this.deps.updater.downloadUpdate();
    } catch (error) {
      this.set({ stage: "error", message: error instanceof Error ? error.message : String(error) });
    }
    return this.status;
  }

  install(): boolean {
    if (!this.deps.isPackaged || this.status.stage !== "downloaded") return false;
    this.deps.updater.quitAndInstall();
    return true;
  }

  private set(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch, checkedAt: this.now() };
    this.deps.emit(this.status);
  }
}
