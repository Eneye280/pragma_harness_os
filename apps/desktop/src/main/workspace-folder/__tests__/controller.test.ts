import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SettingsStore } from "../../settings";
import { WorkspaceFolderController } from "../controller";

let root: string;
let store: SettingsStore;
let fallback: string;

function makeDir(name: string): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "phs34-"));
  store = new SettingsStore(join(root, "config.json"));
  fallback = makeDir("default-workspace");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeController(maxRecents?: number): WorkspaceFolderController {
  return new WorkspaceFolderController({ store, fallback: () => fallback, maxRecents });
}

describe("WorkspaceFolderController", () => {
  it("falls back to the default workspace when none is configured", () => {
    const controller = makeController();
    expect(controller.current()).toBe(fallback);
    expect(controller.state()).toEqual({ active: fallback, recents: [] });
  });

  it("activates a folder, persists it and notifies listeners", () => {
    const controller = makeController();
    const target = makeDir("project-a");
    const events: string[] = [];
    controller.onChange((path) => events.push(path));

    const state = controller.activate(target);
    expect(state.active).toBe(target);
    expect(state.recents).toEqual([target]);
    expect(controller.current()).toBe(target);
    expect(events).toEqual([target]);
    expect(store.get().workspace.active).toBe(target);
  });

  it("dedupes recents and keeps the newest first", () => {
    const controller = makeController();
    const a = makeDir("a");
    const b = makeDir("b");
    controller.activate(a);
    controller.activate(b);
    controller.activate(a);
    expect(controller.recents()).toEqual([a, b]);
  });

  it("caps the recents list", () => {
    const controller = makeController(3);
    const dirs = ["a", "b", "c", "d"].map(makeDir);
    for (const dir of dirs) controller.activate(dir);
    expect(controller.recents()).toEqual([dirs[3], dirs[2], dirs[1]]);
  });

  it("rejects a path that is not a directory", () => {
    const controller = makeController();
    expect(() => controller.activate(join(root, "does-not-exist"))).toThrow(/no es un directorio/);
    expect(controller.current()).toBe(fallback);
  });

  it("drops recents that no longer exist", () => {
    const controller = makeController();
    const a = makeDir("gone");
    controller.activate(a);
    rmSync(a, { recursive: true, force: true });
    expect(controller.recents()).toEqual([]);
    expect(controller.current()).toBe(fallback);
  });
});
