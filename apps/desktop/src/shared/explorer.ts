export type GitStatusKind = "modified" | "untracked" | "staged" | "deleted" | "conflicted";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  gitStatus?: GitStatusKind;
  children?: TreeNode[];
}

export interface ExplorerTreeResult {
  root: string;
  nodes: TreeNode[];
  fileCount: number;
}

export interface ExplorerFile {
  path: string;
  content: string;
  language: string;
  truncated: boolean;
  binary: boolean;
}
