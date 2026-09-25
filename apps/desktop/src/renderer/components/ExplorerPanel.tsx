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
          <EmptyNotice title="No se pudo abrir el workspace" body={explorer.error} actionLabel="Reintentar" onAction={explorer.refresh} />
        ) : explorer.visibleNodes.length === 0 ? (
          explorer.search ? (
            <EmptyNotice title="Sin resultados" body={`Nada coincide con “${explorer.search}”.`} />
          ) : (
            <EmptyNotice
              title="No workspace open"
              body="Configura HARNESS_WORKSPACE o abre una carpeta con archivos para navegar el proyecto."
              actionLabel="Reintentar"
              onAction={explorer.refresh}
            />
          )
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

interface EmptyNoticeProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyNotice({ title, body, actionLabel, onAction }: EmptyNoticeProps): React.ReactElement {
  return (
    <div className="fade-in mx-1 rounded-panel border border-hairline bg-surface-raised p-3">
      <p className="text-[12px] font-medium text-zinc-200">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{body}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-control border border-harness/40 bg-harness/10 px-2.5 py-1 text-[11px] text-harness-soft transition-colors hover:bg-harness/20"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
