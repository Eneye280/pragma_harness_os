import { describe, it, expect } from "vitest";
import { flattenVisibleTree, nextTreeIndex } from "../tree-a11y";
import { ONBOARDING_STEPS, nextOnboardingStep, shouldShowOnboarding } from "../onboarding";
import type { TreeNode } from "@shared/explorer";

const TREE: TreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "dir",
    children: [
      { name: "index.ts", path: "src/index.ts", type: "file", gitStatus: "modified" },
      {
        name: "components",
        path: "src/components",
        type: "dir",
        children: [{ name: "App.tsx", path: "src/components/App.tsx", type: "file" }],
      },
    ],
  },
  { name: "README.md", path: "README.md", type: "file" },
];

describe("tree accessibility", () => {
  it("flattens only expanded directories and tracks level", () => {
    const collapsed = flattenVisibleTree(TREE, new Set(["src"]));
    expect(collapsed.map((row) => row.path)).toEqual(["src", "src/index.ts", "src/components", "README.md"]);
    expect(collapsed.find((row) => row.path === "src/components")).toMatchObject({ type: "dir", level: 2, expanded: false, hasChildren: true });
    expect(collapsed.find((row) => row.path === "src/index.ts")).toMatchObject({ level: 2, gitStatus: "modified" });
  });

  it("includes children when a nested directory is expanded", () => {
    const rows = flattenVisibleTree(TREE, new Set(["src", "src/components"]));
    expect(rows.map((row) => row.path)).toEqual([
      "src",
      "src/index.ts",
      "src/components",
      "src/components/App.tsx",
      "README.md",
    ]);
    expect(rows.find((row) => row.path === "src/components/App.tsx")).toMatchObject({ level: 3, type: "file" });
  });

  it("moves focus without wrapping and clamps at the edges", () => {
    expect(nextTreeIndex(1, "ArrowDown", 4)).toBe(2);
    expect(nextTreeIndex(3, "ArrowDown", 4)).toBe(3);
    expect(nextTreeIndex(0, "ArrowUp", 4)).toBe(0);
    expect(nextTreeIndex(2, "Home", 4)).toBe(0);
    expect(nextTreeIndex(0, "End", 4)).toBe(3);
    expect(nextTreeIndex(0, "ArrowDown", 0)).toBe(0);
  });
});

describe("onboarding state", () => {
  it("shows until dismissed and hides once stored", () => {
    expect(shouldShowOnboarding(null)).toBe(true);
    expect(shouldShowOnboarding("")).toBe(true);
    expect(shouldShowOnboarding("done")).toBe(false);
  });

  it("advances within bounds", () => {
    const total = ONBOARDING_STEPS.length;
    expect(total).toBe(3);
    expect(nextOnboardingStep(0, total)).toBe(1);
    expect(nextOnboardingStep(2, total)).toBe(2);
    expect(nextOnboardingStep(0, 0)).toBe(0);
  });
});
