import { describe, it, expect } from "vitest";
import { isEditableTarget, resolveShellShortcut } from "../shortcuts";

describe("Shell shortcuts", () => {
  it("maps primary+b to explorer toggle on ctrl and cmd", () => {
    expect(resolveShellShortcut({ key: "b", ctrlKey: true })).toBe("toggle-explorer");
    expect(resolveShellShortcut({ key: "B", metaKey: true })).toBe("toggle-explorer");
  });

  it("maps primary+shift+c to context toggle", () => {
    expect(resolveShellShortcut({ key: "C", ctrlKey: true, shiftKey: true })).toBe("toggle-context");
    expect(resolveShellShortcut({ key: "c", metaKey: true, shiftKey: true })).toBe("toggle-context");
  });

  it("maps primary+k to the command palette", () => {
    expect(resolveShellShortcut({ key: "k", ctrlKey: true })).toBe("command-palette");
    expect(resolveShellShortcut({ key: "K", metaKey: true })).toBe("command-palette");
  });

  it("ignores chords without primary modifier or with alt", () => {
    expect(resolveShellShortcut({ key: "b" })).toBeNull();
    expect(resolveShellShortcut({ key: "b", shiftKey: true })).toBeNull();
    expect(resolveShellShortcut({ key: "b", ctrlKey: true, altKey: true })).toBeNull();
    expect(resolveShellShortcut({ key: "b", ctrlKey: true, shiftKey: true })).toBeNull();
    expect(resolveShellShortcut({ key: "x", ctrlKey: true })).toBeNull();
  });

  it("detects editable targets so typing does not fire panel toggles", () => {
    expect(isEditableTarget("INPUT", false)).toBe(true);
    expect(isEditableTarget("textarea", false)).toBe(true);
    expect(isEditableTarget("div", true)).toBe(true);
    expect(isEditableTarget("div", false)).toBe(false);
  });
});
