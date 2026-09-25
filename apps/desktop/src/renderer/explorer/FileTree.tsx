import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import type { GitStatusKind, TreeNode } from "@shared/explorer";
import { IconFile, IconFolder } from "../components/icons";
import { flattenVisibleTree, nextTreeIndex, type TreeNavKey } from "../shell/tree-a11y";

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

const NAV_KEYS: TreeNavKey[] = ["ArrowDown", "ArrowUp", "Home", "End"];

interface FileTreeProps {
  nodes: TreeNode[];
  expanded: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedPath?: string | null;
}

export function FileTree({ nodes, expanded, onToggleDir, onSelectFile, selectedPath }: FileTreeProps): React.ReactElement {
  const rows = useMemo(() => flattenVisibleTree(nodes, expanded), [nodes, expanded]);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const elementByPath = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (focusedPath && elementByPath.current.has(focusedPath)) elementByPath.current.get(focusedPath)?.focus();
  }, [focusedPath, rows]);

  useEffect(() => {
    if (focusedPath && !rows.some((row) => row.path === focusedPath)) setFocusedPath(null);
  }, [rows, focusedPath]);

  function focusIndex(index: number): void {
    const row = rows[index];
    if (row) setFocusedPath(row.path);
  }

  function activate(path: string, type: "file" | "dir"): void {
    if (type === "dir") onToggleDir(path);
    else onSelectFile(path);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>): void {
    const index = rows.findIndex((row) => row.path === focusedPath);
    const row = index >= 0 ? rows[index] : null;
    if (NAV_KEYS.includes(event.key as TreeNavKey)) {
      event.preventDefault();
      focusIndex(nextTreeIndex(index < 0 ? 0 : index, event.key as TreeNavKey, rows.length));
      return;
    }
    if (!row) return;
    if (event.key === "ArrowRight" && row.type === "dir" && !row.expanded && row.hasChildren) {
      event.preventDefault();
      onToggleDir(row.path);
    } else if (event.key === "ArrowLeft" && row.type === "dir" && row.expanded) {
      event.preventDefault();
      onToggleDir(row.path);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(row.path, row.type);
    }
  }

  return (
    <ul role="tree" aria-label="Archivos del workspace" className="select-none" onKeyDown={handleKeyDown}>
      {rows.map((row, index) => {
        const isTabStop = focusedPath ? row.path === focusedPath : index === 0;
        const paddingLeft = row.type === "dir" ? 6 + row.level * 10 : 18 + row.level * 10;
        const label = `${row.name}${row.type === "dir" ? (row.expanded ? ", expandido" : ", colapsado") : row.gitStatus ? `, ${STATUS_LABEL[row.gitStatus]}` : ""}`;
        return (
          <li key={row.path} role="none">
            <button
              ref={(element) => {
                if (element) elementByPath.current.set(row.path, element);
                else elementByPath.current.delete(row.path);
              }}
              type="button"
              role="treeitem"
              aria-level={row.level}
              aria-expanded={row.type === "dir" ? row.expanded : undefined}
              aria-selected={row.type === "file" ? selectedPath === row.path : undefined}
              aria-label={label}
              tabIndex={isTabStop ? 0 : -1}
              onClick={() => {
                setFocusedPath(row.path);
                activate(row.path, row.type);
              }}
              style={{ paddingLeft }}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-control py-[3px] pr-2 text-left text-[12px] transition-colors hover:bg-zinc-800/70 hover:text-zinc-100",
                row.type === "file" && selectedPath === row.path ? "bg-harness/15 text-zinc-100" : "text-zinc-400",
              )}
            >
              <span className="text-zinc-600" aria-hidden="true">
                {row.type === "dir" ? (row.expanded ? "▾" : "▸") : ""}
              </span>
              {row.type === "dir" ? (
                <IconFolder width={13} height={13} className="text-zinc-500" aria-hidden="true" />
              ) : (
                <IconFile width={13} height={13} className="text-zinc-600" aria-hidden="true" />
              )}
              <span className="truncate">{row.name}</span>
              {row.gitStatus ? (
                <span
                  title={STATUS_LABEL[row.gitStatus]}
                  className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", STATUS_COLOR[row.gitStatus])}
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
