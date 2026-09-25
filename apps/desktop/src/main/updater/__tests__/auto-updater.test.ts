import { describe, it, expect, vi } from "vitest";
import { AutoUpdaterService, type UpdaterPort } from "../auto-updater";
import type { UpdateStatus } from "../../../shared/updater";

class FakeUpdater {
  autoDownload = false;
  checkForUpdates = vi.fn(async () => undefined);
  downloadUpdate = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
  private listeners = new Map<string, Array<(payload?: unknown) => void>>();

  on(event: string, listener: (payload?: unknown) => void): this {
    const current = this.listeners.get(event) ?? [];
    current.push(listener);
    this.listeners.set(event, current);
    return this;
  }

  emit(event: string, payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

function makeService(options: { isPackaged: boolean; updater: FakeUpdater; version?: string }) {
  const statuses: UpdateStatus[] = [];
  const service = new AutoUpdaterService({
    updater: options.updater as unknown as UpdaterPort,
    isPackaged: options.isPackaged,
    currentVersion: options.version ?? "0.1.0",
    emit: (status) => statuses.push(status),
    now: () => 1000,
  });
  return { service, statuses };
}

describe("AutoUpdaterService", () => {
  it("enables autoDownload and wires the update lifecycle when packaged", () => {
    const updater = new FakeUpdater();
    const { service, statuses } = makeService({ isPackaged: true, updater });
    service.init();

    expect(updater.autoDownload).toBe(true);
    expect(service.getStatus().stage).toBe("idle");

    updater.emit("checking-for-update");
    updater.emit("update-available", { version: "1.2.0" });
    updater.emit("download-progress", { percent: 42.6 });
    updater.emit("update-downloaded", { version: "1.2.0" });

    expect(statuses.map((status) => status.stage)).toEqual(["checking", "available", "downloading", "downloaded"]);
    expect(service.getStatus()).toMatchObject({ stage: "downloaded", version: "1.2.0", currentVersion: "0.1.0" });
    expect(statuses[2].percent).toBe(43);
  });

  it("reports disabled in a dev (unpackaged) build", () => {
    const updater = new FakeUpdater();
    const { service } = makeService({ isPackaged: false, updater });
    service.init();
    expect(service.getStatus().stage).toBe("disabled");
    expect(service.getStatus().message).toContain("dev build");
  });

  it("short-circuits check and download when not packaged", async () => {
    const updater = new FakeUpdater();
    const { service } = makeService({ isPackaged: false, updater });
    service.init();

    const checked = await service.check();
    const downloaded = await service.download();
    expect(checked.stage).toBe("disabled");
    expect(downloaded.stage).toBe("disabled");
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
  });

  it("delegates checkForUpdates and surfaces errors", async () => {
    const updater = new FakeUpdater();
    const { service } = makeService({ isPackaged: true, updater });
    service.init();

    await service.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    updater.checkForUpdates.mockRejectedValueOnce(new Error("feed unreachable"));
    const errored = await service.check();
    expect(errored.stage).toBe("error");
    expect(errored.message).toBe("feed unreachable");
  });

  it("download delegates and install only works once downloaded", async () => {
    const updater = new FakeUpdater();
    const { service } = makeService({ isPackaged: true, updater });
    service.init();

    expect(service.install()).toBe(false);
    await service.download();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);

    updater.emit("update-downloaded", { version: "2.0.0" });
    expect(service.install()).toBe(true);
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
