import { describe, expect, it } from "vitest";
import {
  applyProjectPrefs,
  isHidden,
  isPinned,
  loadProjectPrefs,
  saveProjectPrefs,
  toggleHidden,
  togglePinned,
  type ProjectPrefs,
} from "../project-prefs";
import type { ProjectGroup } from "../project-tree";

function storage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function group(path: string, active = false): ProjectGroup {
  return { path, name: path.split(/[\\/]/).pop() ?? path, active, sessions: [] };
}

describe("project prefs", () => {
  it("toggles pinned and hidden and persists them", () => {
    const store = storage();
    let prefs = loadProjectPrefs(store);
    prefs = togglePinned(prefs, "C:\\repo\\a");
    prefs = toggleHidden(prefs, "C:\\repo\\b");
    saveProjectPrefs(store, prefs);

    const reloaded = loadProjectPrefs(store);
    expect(isPinned(reloaded, "c:/repo/A")).toBe(true);
    expect(isHidden(reloaded, "C:\\repo\\b\\")).toBe(true);
    expect(togglePinned(reloaded, "C:\\repo\\a").pinned).toEqual([]);
  });

  it("returns empty prefs on corrupt data", () => {
    expect(loadProjectPrefs(storage({ "pragma-harness:project-prefs": "{" }))).toEqual<ProjectPrefs>({ pinned: [], hidden: [] });
  });

  it("hides projects but never the active one, and floats pinned to the top", () => {
    const prefs: ProjectPrefs = { pinned: ["C:\\repo\\b"], hidden: ["C:\\repo\\c"] };
    const result = applyProjectPrefs([group("C:\\repo\\a", true), group("C:\\repo\\b"), group("C:\\repo\\c")], prefs);
    expect(result.map((entry) => entry.path)).toEqual(["C:\\repo\\b", "C:\\repo\\a"]);

    const hiddenActive = applyProjectPrefs([group("C:\\repo\\c", true)], { pinned: [], hidden: ["C:\\repo\\c"] });
    expect(hiddenActive).toHaveLength(1);
  });
});
