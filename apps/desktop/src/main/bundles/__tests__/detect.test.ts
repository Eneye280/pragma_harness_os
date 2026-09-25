import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { detectStack } from "../detect";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "phs36-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe("detectStack", () => {
  it("treats an empty folder as blank", () => {
    const root = makeRoot();
    expect(detectStack(root)).toMatchObject({ blank: true, entries: 0, suggestions: [] });
  });

  it("ignores dot-folders like .git and .pragma-harness", () => {
    const root = makeRoot();
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, ".pragma-harness"));
    expect(detectStack(root).blank).toBe(true);
  });

  it("suggests backend for a tsconfig-only folder", () => {
    const root = makeRoot();
    writeFileSync(join(root, "tsconfig.json"), "{}", "utf8");
    const detection = detectStack(root);
    expect(detection.blank).toBe(false);
    expect(detection.suggestions).toContain("backend");
  });

  it("suggests unity when Assets/ exists", () => {
    const root = makeRoot();
    mkdirSync(join(root, "Assets"));
    expect(detectStack(root).suggestions).toContain("unity");
  });

  it("suggests unreal for a .uproject file", () => {
    const root = makeRoot();
    writeFileSync(join(root, "game.uproject"), "{}", "utf8");
    expect(detectStack(root).suggestions).toContain("unreal");
  });

  it("suggests web for a package.json", () => {
    const root = makeRoot();
    writeFileSync(join(root, "package.json"), "{}", "utf8");
    expect(detectStack(root).suggestions).toContain("web");
  });
});
