import { cn } from "../lib/cn";
import type { GitStatusKind, TreeNode } from "@shared/explorer";
import { IconFile, IconFolder } from "../components/icons";

const STATUS_COLOR: Record<GitStatusKind, string> = {
  modified: "bg-amber-500",
  untracked: "bg-emerald-500",
  staged: "bg-harness",
  deleted: "bg-red-500",
  conflicted: "bg-red-500",
};

const STATUS_LABEL: Record<GitStatusKind, string> = {
  modified: "modificado",
  untracked: "sin trackear",
  staged: "staged",
  deleted: "borrado",
  conflicted: "conflicto",
};

interface FileTreeProps {
  nodes: TreeNode[];
  expanded: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedPath?: string | null;
}

export function FileTree({ nodes, expanded, onToggleDir, onSelectFile, selectedPath }: FileTreeProps): React.ReactElement {
  return (
    <ul className="select-none">
      {nodes.map((node) =>
        node.type === "dir" ? (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onToggleDir(node.path)}
              style={{ paddingLeft: 6 + node.path.split("/").length * 10 }}
              className="flex w-full items-center gap-1.5 rounded-control py-[3px] pr-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
            >
              <span className="text-zinc-600">{expanded.has(node.path) ? "▾" : "▸"}</span>
              <IconFolder width={13} height={13} className="text-zinc-500" />
              <span className="truncate">{node.name}</span>
            </button>
            {expanded.has(node.path) && node.children ? (
              <FileTree
                nodes={node.children}
                expanded={expanded}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ) : null}
          </li>
        ) : (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onSelectFile(node.path)}
              style={{ paddingLeft: 18 + node.path.split("/").length * 10 }}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-control py-[3px] pr-2 text-left text-[12px] transition-colors",
                selectedPath === node.path ? "bg-harness/15 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100",
              )}
            >
              <IconFile width={13} height={13} className="text-zinc-600" />
              <span className="truncate">{node.name}</span>
              {node.gitStatus ? (
                <span
                  title={STATUS_LABEL[node.gitStatus]}
                  className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLOR[node.gitStatus])}
                />
              ) : null}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
