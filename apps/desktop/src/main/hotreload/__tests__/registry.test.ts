import { describe, expect, it } from "vitest";
import { HotReloadRegistry, type HotReloadChange, type WatchHandle } from "../index";

function fakeWatchFactory(): { factory: (path: string, onChange: (changedPath: string) => void) => WatchHandle; emit: (path: string, changedPath: string) => void; closed: string[] } {
  const listeners = new Map<string, (changedPath: string) => void>();
  const closed: string[] = [];
  return {
    closed,
    factory: (path, onChange) => {
      listeners.set(path, onChange);
      return { close: () => closed.push(path) };
    },
    emit: (path, changedPath) => listeners.get(path)?.(changedPath),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("hot reload registry", () => {
  it("debounces changes, invalidates and emits once per batch", async () => {
    const watcher = fakeWatchFactory();
    const changes: HotReloadChange[] = [];
    const invalidated: string[] = [];
    const registry = new HotReloadRegistry({
      targets: [
        { kind: "skills", path: "/ws/skills", invalidate: () => invalidated.push("skills") },
        { kind: "agents", path: "/ws/.pragma-harness/agents", invalidate: () => invalidated.push("agents") },
      ],
      onChange: (change) => changes.push(change),
      debounceMs: 10,
      watchFactory: watcher.factory,
    });
    registry.start();

    watcher.emit("/ws/skills", "/ws/skills/foo/SKILL.md");
    watcher.emit("/ws/skills", "/ws/skills/bar/SKILL.md");
    watcher.emit("/ws/.pragma-harness/agents", "/ws/.pragma-harness/agents/custom.json");
    await sleep(40);

    expect(changes).toHaveLength(1);
    expect(changes[0].kinds.sort()).toEqual(["agents", "skills"]);
    expect(changes[0].paths).toHaveLength(3);
    expect(invalidated.sort()).toEqual(["agents", "skills"]);
  });

  it("refresh() force-invalidates every target and emits", () => {
    const watcher = fakeWatchFactory();
    const changes: HotReloadChange[] = [];
    const invalidated: string[] = [];
    const registry = new HotReloadRegistry({
      targets: [
        { kind: "skills", path: "/ws/skills", invalidate: () => invalidated.push("skills") },
        { kind: "plugins", path: "/ws/.pragma-harness/plugins", invalidate: () => invalidated.push("plugins") },
      ],
      onChange: (change) => changes.push(change),
      debounceMs: 10,
      watchFactory: watcher.factory,
    });
    registry.start();
    registry.refresh();
    expect(invalidated.sort()).toEqual(["plugins", "skills"]);
    expect(changes).toHaveLength(1);
    expect(changes[0].kinds.sort()).toEqual(["plugins", "skills"]);
  });

  it("stop() closes every watcher and drops pending work", async () => {
    const watcher = fakeWatchFactory();
    const changes: HotReloadChange[] = [];
    const registry = new HotReloadRegistry({
      targets: [{ kind: "skills", path: "/ws/skills", invalidate: () => undefined }],
      onChange: (change) => changes.push(change),
      debounceMs: 20,
      watchFactory: watcher.factory,
    });
    registry.start();
    watcher.emit("/ws/skills", "/ws/skills/x/SKILL.md");
    registry.stop();
    await sleep(40);
    expect(changes).toHaveLength(0);
    expect(watcher.closed).toEqual(["/ws/skills"]);
  });
});
