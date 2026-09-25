import type { TreeNode } from "@shared/explorer";

export function flattenFiles(nodes: TreeNode[]): string[] {
  const files: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") files.push(node.path);
    else if (node.children) files.push(...flattenFiles(node.children));
  }
  return files;
}

export function collectDirPaths(nodes: TreeNode[]): string[] {
  const dirs: string[] = [];
  for (const node of nodes) {
    if (node.type === "dir") {
      dirs.push(node.path);
      if (node.children) dirs.push(...collectDirPaths(node.children));
    }
  }
  return dirs;
}

export function filterTree(nodes: TreeNode[], rawQuery: string): TreeNode[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return nodes;

  const filtered: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.path.toLowerCase().includes(query)) filtered.push(node);
      continue;
    }
    const children = node.children ? filterTree(node.children, query) : [];
    if (children.length > 0 || node.name.toLowerCase().includes(query)) {
      filtered.push({ ...node, children });
    }
  }
  return filtered;
}
