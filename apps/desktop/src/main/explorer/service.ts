import { readFileSync, statSync } from "fs";
import { extname } from "path";
import fastGlob from "fast-glob";
import { simpleGit } from "simple-git";
import { resolveInsideWorkspace } from "../tools/file-tools";
import type { ExplorerFile, ExplorerTreeResult, GitStatusKind, TreeNode } from "../../shared/explorer";

const IGNORED_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/out/**",
  "**/build/**",
  "**/coverage/**",
  "**/.harness/**",
  "**/.next/**",
];

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".sql": "sql",
  ".sh": "shell",
  ".cs": "csharp",
  ".lua": "lua",
  ".glsl": "glsl",
};

const MAX_PREVIEW_BYTES = 200_000;

export function languageForPath(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[extname(filePath).toLowerCase()] ?? "plaintext";
}

export function classifyGitStatus(index: string, workingDir: string): GitStatusKind {
  if (index === "?" && workingDir === "?") return "untracked";
  if (index === "U" || workingDir === "U") return "conflicted";
  if (index === "D" || workingDir === "D") return "deleted";
  if (index !== " " && index !== "?" && index !== "D") return "staged";
  return "modified";
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === "dir" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  for (const node of nodes) {
    if (node.children) sortNodes(node.children);
  }
  return nodes;
}

export class ExplorerService {
  constructor(private readonly workspacePath: string) {}

  get root(): string {
    return this.workspacePath;
  }

  async gitStatusMap(): Promise<Map<string, GitStatusKind>> {
    const statusMap = new Map<string, GitStatusKind>();
    try {
      const status = await simpleGit(this.workspacePath).status();
      for (const file of status.files) {
        const normalizedPath = file.path.replace(/\\/g, "/");
        statusMap.set(normalizedPath, classifyGitStatus(file.index, file.working_dir));
      }
    } catch {
      return statusMap;
    }
    return statusMap;
  }

  async getTree(): Promise<ExplorerTreeResult> {
    const files = await fastGlob("**/*", {
      cwd: this.workspacePath,
      onlyFiles: true,
      dot: false,
      ignore: IGNORED_GLOBS,
      followSymbolicLinks: false,
    });
    const statusMap = await this.gitStatusMap();
    const rootNodes: TreeNode[] = [];
    const dirIndex = new Map<string, TreeNode>();

    for (const relativePath of files) {
      const segments = relativePath.split("/");
      let parentPath = "";
      let cursor = rootNodes;
      for (let depth = 0; depth < segments.length - 1; depth++) {
        const segment = segments[depth];
        const dirPath = parentPath ? `${parentPath}/${segment}` : segment;
        let dirNode = dirIndex.get(dirPath);
        if (!dirNode) {
          dirNode = { name: segment, path: dirPath, type: "dir", children: [] };
          dirIndex.set(dirPath, dirNode);
          cursor.push(dirNode);
        }
        cursor = dirNode.children as TreeNode[];
        parentPath = dirPath;
      }
      cursor.push({
        name: segments[segments.length - 1],
        path: relativePath,
        type: "file",
        gitStatus: statusMap.get(relativePath),
      });
    }

    return { root: this.workspacePath, nodes: sortNodes(rootNodes), fileCount: files.length };
  }

  readFile(relativePath: string): ExplorerFile {
    const absolutePath = resolveInsideWorkspace(this.workspacePath, relativePath);
    const size = statSync(absolutePath).size;
    const rawBuffer = readFileSync(absolutePath);
    const isBinary = rawBuffer.subarray(0, 8000).includes(0);
    if (isBinary) {
      return { path: relativePath, content: "", language: "binary", truncated: false, binary: true };
    }
    const truncated = size > MAX_PREVIEW_BYTES;
    const content = rawBuffer.subarray(0, MAX_PREVIEW_BYTES).toString("utf8");
    return { path: relativePath, content, language: languageForPath(relativePath), truncated, binary: false };
  }
}
