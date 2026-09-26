import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { applyTheme, isThemeMode, loadThemeMode, resolveTheme, saveThemeMode } from "../theme";
import { auditLightPalette } from "../contrast";

const CSS_PATH = join(process.cwd(), "src", "renderer", "styles", "globals.css");

describe("theme", () => {
  it("resolves system, light and dark", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("applies the theme to the document", () => {
    const attributes: Record<string, string> = {};
    const target = { documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value), style: { colorScheme: "" } } };
    expect(applyTheme("light", true, target)).toBe("light");
    expect(attributes["data-theme"]).toBe("light");
    expect(target.documentElement.style.colorScheme).toBe("light");
  });

  it("persists the mode with a safe default", () => {
    const data: Record<string, string> = {};
    const storage = { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value; } };
    expect(loadThemeMode(storage)).toBe("system");
    saveThemeMode(storage, "dark");
    expect(loadThemeMode(storage)).toBe("dark");
    expect(isThemeMode("nope")).toBe(false);
  });

  it("ships a light theme block and AA-compliant light palette", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain("color-scheme: light");
    for (const check of auditLightPalette()) {
      expect(check.ratio, `${check.pair} = ${check.ratio}`).toBeGreaterThanOrEqual(check.min);
    }
  });
});
