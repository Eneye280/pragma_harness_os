import { FileTree } from "../explorer/FileTree";
import type { UseExplorerResult } from "../explorer/use-explorer";
import { IconSearch } from "./icons";

interface ExplorerPanelProps {
  explorer: UseExplorerResult;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export function ExplorerPanel({ explorer, selectedPath, onSelectFile }: ExplorerPanelProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Explorer</span>
        <div className="ml-auto flex items-center gap-1 rounded-control bg-surface-raised px-1.5 py-0.5">
          <IconSearch width={12} height={12} className="text-zinc-500" />
          <input
            value={explorer.search}
            onChange={(event) => explorer.setSearch(event.target.value)}
            placeholder="filtrar"
            aria-label="Filtrar archivos"
            className="w-[92px] bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="truncate text-[11px] font-medium text-zinc-300">{explorer.root ?? "workspace"}</span>
          <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-[1px] text-[10px] text-zinc-400">{explorer.fileCount}</span>
        </div>

        {explorer.loading ? (
          <p className="px-1 py-2 text-[11px] text-zinc-600">cargando…</p>
        ) : explorer.error ? (
          <p className="px-1 py-2 text-[11px] text-red-400">{explorer.error}</p>
        ) : explorer.visibleNodes.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-zinc-600">sin resultados</p>
        ) : (
          <FileTree
            nodes={explorer.visibleNodes}
            expanded={explorer.expanded}
            onToggleDir={explorer.toggleDir}
            onSelectFile={onSelectFile}
            selectedPath={selectedPath}
          />
        )}
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[10px] text-zinc-600">watcher en vivo · chokidar</div>
    </div>
  );
}
