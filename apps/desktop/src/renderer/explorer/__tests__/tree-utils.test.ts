import { describe, it, expect } from "vitest";
import { collectDirPaths, filterTree, flattenFiles } from "../tree-utils";
import type { TreeNode } from "@shared/explorer";

const TREE: TreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "dir",
    children: [
      { name: "index.ts", path: "src/index.ts", type: "file", gitStatus: "modified" },
      {
        name: "chat",
        path: "src/chat",
        type: "dir",
        children: [{ name: "reducer.ts", path: "src/chat/reducer.ts", type: "file", gitStatus: "untracked" }],
      },
    ],
  },
  { name: "README.md", path: "README.md", type: "file" },
];

describe("Explorer tree utils", () => {
  it("flattens file paths recursively", () => {
    expect(flattenFiles(TREE)).toEqual(["src/index.ts", "src/chat/reducer.ts", "README.md"]);
  });

  it("collects directory paths recursively", () => {
    expect(collectDirPaths(TREE)).toEqual(["src", "src/chat"]);
  });

  it("filters files by query keeping ancestor directories", () => {
    const filtered = filterTree(TREE, "reducer");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe("src");
    expect(filtered[0].children?.[0].path).toBe("src/chat");
    expect(filtered[0].children?.[0].children?.[0].path).toBe("src/chat/reducer.ts");
  });

  it("matches directories by name too", () => {
    const filtered = filterTree(TREE, "chat");
    expect(filtered[0].children?.[0].children?.[0].path).toBe("src/chat/reducer.ts");
  });

  it("returns the original tree for an empty query", () => {
    expect(filterTree(TREE, "  ")).toBe(TREE);
  });

  it("returns nothing when no file matches", () => {
    expect(filterTree(TREE, "zzz-none")).toEqual([]);
  });
});
