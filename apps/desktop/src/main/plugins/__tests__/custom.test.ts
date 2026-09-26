import { describe, expect, it } from "vitest";
import { compileCustomPlugin } from "../custom";
import { createCustomPluginTemplate, type CustomPluginDef } from "../../../shared/plugin-authoring";

const baseContext = {
  message: "agrega un endpoint",
  normalized: "agrega un endpoint",
  sessionId: "s1",
  workspaceHash: "w",
  workspacePath: "/tmp",
  timestamp: Date.now(),
};

describe("custom plugin host", () => {
  it("blocks when the message matches", async () => {
    const def: CustomPluginDef = { ...createCustomPluginTemplate("no-todo"), name: "no-todo", match: "TODO", message: "quita el TODO" };
    const plugin = compileCustomPlugin(def);
    const result = await plugin.hook({ ...baseContext, normalized: "dejé un TODO en el código" });
    expect(result).toEqual({ action: "block", reason: "quita el TODO" });
  });

  it("also matches against the diff for post-agent plugins", async () => {
    const def: CustomPluginDef = { ...createCustomPluginTemplate("no-console"), name: "no-console", stage: "post-agent", match: "console\\.log", message: "sin console.log" };
    const plugin = compileCustomPlugin(def);
    expect(plugin.stage).toBe("post-agent");
    const result = await plugin.hook({ ...baseContext, diff: "+ console.log('x')" });
    expect(result.action).toBe("block");
  });

  it("passes when there is no match and injects skills", async () => {
    const def: CustomPluginDef = { ...createCustomPluginTemplate("skill-push"), name: "skill-push", match: "vulkan", action: "inject-skill", skillName: "tdd-workflow" };
    const plugin = compileCustomPlugin(def);
    expect(await plugin.hook(baseContext)).toEqual({ action: "pass" });
    expect(await plugin.hook({ ...baseContext, normalized: "pipeline vulkan" })).toEqual({ action: "inject-skill", skillName: "tdd-workflow" });
  });
});
