import { describe, it, expect, vi } from "vitest";
import { SeedPluginRunner } from "../registry";
import type { HarnessPlugin, PluginContext } from "../../harness/plugin-chain";

function context(): PluginContext {
  return { message: "hola", normalized: "hola", sessionId: "s1", workspaceHash: "h", workspacePath: "/ws", timestamp: 1 };
}

function plugin(name: string, stage: HarnessPlugin["stage"], priority: number, hook: HarnessPlugin["hook"]): HarnessPlugin {
  return { name, version: "0", stage, priority, hook };
}

describe("SeedPluginRunner", () => {
  it("runs enabled plugins per stage in priority order", async () => {
    const order: string[] = [];
    const runner = new SeedPluginRunner([
      plugin("b", "pre-agent", 20, async () => {
        order.push("b");
        return { action: "pass" };
      }),
      plugin("a", "pre-agent", 10, async () => {
        order.push("a");
        return { action: "pass" };
      }),
      plugin("post", "post-agent", 5, async () => {
        order.push("post");
        return { action: "pass" };
      }),
    ]);
    await runner.runPreAgent(context());
    expect(order).toEqual(["a", "b"]);
  });

  it("stops at the first blocking plugin", async () => {
    const later = vi.fn(async () => ({ action: "pass" as const }));
    const runner = new SeedPluginRunner(
      [plugin("blocker", "pre-agent", 10, async () => ({ action: "block", reason: "no" })), plugin("later", "pre-agent", 20, later)],
      () => true
    );
    const result = await runner.runPreAgent(context());
    expect(result.blocked).toEqual({ plugin: "blocker", reason: "no" });
    expect(later).not.toHaveBeenCalled();
  });

  it("skips disabled plugins", async () => {
    const hook = vi.fn(async () => ({ action: "pass" as const }));
    const runner = new SeedPluginRunner([plugin("off", "pre-agent", 10, hook)], (name) => name !== "off");
    await runner.runPreAgent(context());
    expect(hook).not.toHaveBeenCalled();
  });

  it("does not break the pipeline when a plugin throws", async () => {
    const runner = new SeedPluginRunner([
      plugin("boom", "pre-agent", 10, async () => {
        throw new Error("plugin crash");
      }),
      plugin("ok", "pre-agent", 20, async () => ({ action: "pass" })),
    ]);
    await expect(runner.runPreAgent(context())).resolves.toEqual({});
  });
});
