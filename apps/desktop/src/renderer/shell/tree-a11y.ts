import type { TreeNode } from "@shared/explorer";

export interface FlatTreeRow {
  path: string;
  name: string;
  type: "file" | "dir";
  level: number;
  expanded: boolean;
  hasChildren: boolean;
  gitStatus?: TreeNode["gitStatus"];
}

export function flattenVisibleTree(nodes: TreeNode[], expanded: Set<string>, level = 1): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];
  for (const node of nodes) {
    const isDir = node.type === "dir";
    const hasChildren = isDir && Boolean(node.children && node.children.length > 0);
    const isExpanded = isDir && expanded.has(node.path);
    rows.push({
      path: node.path,
      name: node.name,
      type: isDir ? "dir" : "file",
      level,
      expanded: isExpanded,
      hasChildren,
      gitStatus: node.gitStatus,
    });
    if (isDir && isExpanded && node.children) rows.push(...flattenVisibleTree(node.children, expanded, level + 1));
  }
  return rows;
}

export type TreeNavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export function nextTreeIndex(current: number, key: TreeNavKey, count: number): number {
  if (count <= 0) return 0;
  const clamped = Math.min(Math.max(current, 0), count - 1);
  switch (key) {
    case "ArrowDown":
      return Math.min(clamped + 1, count - 1);
    case "ArrowUp":
      return Math.max(clamped - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}
