import { cn } from "../lib/cn";
import { IconFile, IconFolder, IconSearch } from "./icons";

interface TreeEntry {
  name: string;
  depth: number;
  kind: "folder" | "file";
  status?: "modified" | "untracked" | "staged";
}

const MOCK_TREE: TreeEntry[] = [
  { name: "packages", depth: 0, kind: "folder" },
  { name: "harness-core", depth: 1, kind: "folder" },
  { name: "src", depth: 2, kind: "folder" },
  { name: "classifier.ts", depth: 3, kind: "file", status: "modified" },
  { name: "skill-compiler.ts", depth: 3, kind: "file" },
  { name: "context-assembler.ts", depth: 3, kind: "file", status: "staged" },
  { name: "apps", depth: 0, kind: "folder" },
  { name: "desktop", depth: 1, kind: "folder" },
  { name: "src", depth: 2, kind: "folder" },
  { name: "main", depth: 3, kind: "folder" },
  { name: "renderer", depth: 3, kind: "folder" },
  { name: "ShellLayout.tsx", depth: 4, kind: "file", status: "untracked" },
];

const STATUS_DOT: Record<NonNullable<TreeEntry["status"]>, string> = {
  modified: "bg-amber-500",
  untracked: "bg-emerald-500",
  staged: "bg-harness",
};

export function ExplorerPanel(): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Explorer</span>
        <button
          type="button"
          aria-label="Search files (Ctrl/Cmd+P)"
          title="Search files (TASK 20)"
          className="ml-auto rounded-control p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <IconSearch width={13} height={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-medium text-zinc-300">pragma-harness-os</span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-[1px] text-[10px] text-zinc-400">worktree</span>
        </div>
        <ul>
          {MOCK_TREE.map((entry) => (
            <li key={`${entry.depth}-${entry.name}`}>
              <span
                className="flex items-center gap-1.5 rounded-control py-[3px] pr-2 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
                style={{ paddingLeft: 6 + entry.depth * 12 }}
              >
                {entry.kind === "folder" ? (
                  <IconFolder width={13} height={13} className="text-zinc-500" />
                ) : (
                  <IconFile width={13} height={13} className="text-zinc-600" />
                )}
                <span className="truncate">{entry.name}</span>
                {entry.status ? <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", STATUS_DOT[entry.status])} /> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[10px] text-zinc-600">
        File tree en vivo · TASK 20
      </div>
    </div>
  );
}
