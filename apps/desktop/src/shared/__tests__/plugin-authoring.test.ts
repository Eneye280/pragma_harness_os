import { describe, expect, it } from "vitest";
import {
  createCustomPluginTemplate,
  parseCustomPluginJson,
  validateCustomPlugin,
  validateProjectTasks,
  type CustomPluginDef,
} from "../plugin-authoring";

const valid: CustomPluginDef = { ...createCustomPluginTemplate("no-todo"), match: "TODO|FIXME", message: "no dejes TODO" };

describe("plugin-authoring", () => {
  it("validates a block plugin", () => {
    expect(validateCustomPlugin(valid).ok).toBe(true);
  });

  it("requires a valid name, match and action payload", () => {
    const bad = { ...valid, name: "Bad Name", match: "(", action: "block" as const, message: "" };
    const result = validateCustomPlugin(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("kebab-case"))).toBe(true);
    expect(result.errors.some((error) => error.includes("regular"))).toBe(true);
    expect(result.errors.some((error) => error.includes("message"))).toBe(true);
  });

  it("requires skillName for inject-skill", () => {
    const result = validateCustomPlugin({ ...valid, action: "inject-skill", skillName: "", message: "" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("skillName"))).toBe(true);
  });

  it("round-trips a plugin definition through JSON", () => {
    const parsed = parseCustomPluginJson(JSON.parse(JSON.stringify(valid)));
    expect(parsed).toMatchObject({ name: "no-todo", priority: 50, action: "block" });
    expect(parseCustomPluginJson({ name: 42 })).toBeNull();
  });

  it("validates project tasks", () => {
    expect(validateProjectTasks([{ id: "a", title: "uno", done: false }]).ok).toBe(true);
    const bad = validateProjectTasks([
      { id: "a", title: "uno", done: false },
      { id: "a", title: "", done: false },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((error) => error.includes("duplicado"))).toBe(true);
  });
});
