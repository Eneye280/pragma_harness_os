import { useState } from "react";
import type { SessionSummary } from "@shared/session";
import { FileTree } from "../explorer/FileTree";
import type { UseExplorerResult } from "../explorer/use-explorer";
import { cn } from "../lib/cn";
import { formatRelativeTime } from "../shell/session-utils";
import { groupSessionsByProject } from "../shell/project-tree";
import { IconFolder, IconSearch } from "./icons";

interface ExplorerPanelProps {
  explorer: UseExplorerResult;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onOpenFolder: () => void;
  recents: string[];
  onPickRecent: (path: string) => void;
  openingFolder?: boolean;
  activePath: string;
  sessions: SessionSummary[];
  currentSessionId: string;
  runningSessions: string[];
  onOpenSession: (id: string) => void;
  onNewSession: () => void;
}

export function ExplorerPanel({
  explorer,
  selectedPath,
  onSelectFile,
  onOpenFolder,
  recents,
  onPickRecent,
  openingFolder,
  activePath,
  sessions,
  currentSessionId,
  runningSessions,
  onOpenSession,
  onNewSession,
}: ExplorerPanelProps): React.ReactElement {
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});
  const query = explorer.search.trim().toLowerCase();

  // Un solo sidebar: buscador arriba y, debajo, proyectos → sesiones.
  // Se ocultan los proyectos sin sesiones (no mostramos carpetas vacías).
  const projects = groupSessionsByProject(sessions, activePath, recents)
    .map((group) => ({
      ...group,
      sessions: query ? group.sessions.filter((session) => session.title.toLowerCase().includes(query)) : group.sessions,
    }))
    .filter((group) => group.active || group.sessions.length > 0);

  const hasProject = Boolean(activePath);
  const files = explorer.visibleNodes;

  function toggleProject(path: string, current: boolean): void {
    setExpandedOverride((state) => ({ ...state, [path]: !current }));
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-hairline p-2.5">
        <div className="flex items-center gap-2">
          <label className="field flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
            <IconSearch width={13} height={13} className="shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              value={explorer.search}
              onChange={(event) => explorer.setSearch(event.target.value)}
              placeholder="Buscar sesiones o archivos…"
              aria-label="Buscar en el proyecto"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => explorer.setSearch("")}
                className="shrink-0 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
              >
                ✕
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={onOpenFolder}
            disabled={openingFolder}
            aria-label="Abrir proyecto"
            title="Abrir proyecto…"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-hairline text-zinc-400 transition-colors hover:border-harness/40 hover:text-zinc-100 disabled:opacity-40"
          >
            <IconFolder width={15} height={15} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {projects.length === 0 ? (
          <div className="rounded-panel border border-dashed border-hairline px-3 py-3 text-[12px] leading-relaxed text-zinc-500">
            {query ? `Sin coincidencias para “${explorer.search}”.` : "Abre un proyecto para empezar: el harness trabaja siempre sobre un folder."}
          </div>
        ) : null}

        {projects.map((group) => {
          const isExpanded = expandedOverride[group.path] ?? group.active;
          return (
            <div key={group.path} className="mb-1">
              <div
                className={cn(
                  "group flex items-center gap-1.5 rounded-control px-1 py-1.5 transition-colors",
                  group.active ? "bg-harness/10" : "hover:bg-surface-raised/70",
                )}
              >
                <button
                  type="button"
                  aria-label={isExpanded ? `Colapsar ${group.name}` : `Expandir ${group.name}`}
                  onClick={() => toggleProject(group.path, isExpanded)}
                  className="flex h-6 w-5 shrink-0 items-center justify-center rounded-control text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
                <button type="button" onClick={() => onPickRecent(group.path)} title={group.path} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <IconFolder width={15} height={15} className={cn("shrink-0", group.active ? "text-harness-soft" : "text-zinc-500")} />
                  <span className={cn("truncate text-[13px]", group.active ? "font-medium text-zinc-100" : "text-zinc-300")}>{group.name}</span>
                  <span className="ml-auto shrink-0 rounded-pill bg-surface-raised px-1.5 text-[12px] text-zinc-500">{group.sessions.length}</span>
                </button>
                {group.active ? (
                  <button
                    type="button"
                    aria-label="Nueva sesión"
                    title="Nueva sesión en este proyecto"
                    onClick={onNewSession}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-zinc-400 transition-colors hover:bg-harness/20 hover:text-harness-soft"
                  >
                    +
                  </button>
                ) : null}
              </div>

              {isExpanded ? (
                <div className="ml-3 border-l border-hairline pl-2">
                  <ul className="space-y-0.5">
                    {group.sessions.map((session) => {
                      const isCurrent = group.active && session.id === currentSessionId;
                      const isRunning = runningSessions.includes(session.id);
                      return (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => (group.active ? onOpenSession(session.id) : onPickRecent(group.path))}
                            title={session.title}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12px] transition-colors",
                              isCurrent ? "bg-harness/15 text-zinc-100" : "text-zinc-400 hover:bg-surface-raised/70 hover:text-zinc-200",
                            )}
                          >
                            {isRunning ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-harness" aria-hidden="true" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden="true" />}
                            <span className="truncate">{session.title}</span>
                            <span className="ml-auto shrink-0 font-mono text-[12px] text-zinc-600">{formatRelativeTime(session.updatedAt)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {group.active && isExpanded && files.length > 0 ? (
                    <div className="mt-1.5">
                      <p className="mb-1 px-2 text-[12px] font-medium text-zinc-500">Archivos</p>
                      <FileTree
                        nodes={files}
                        expanded={explorer.expanded}
                        onToggleDir={explorer.toggleDir}
                        onSelectFile={onSelectFile}
                        selectedPath={selectedPath}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {hasProject && query && files.length === 0 && projects.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-zinc-600">Sin archivos que coincidan.</p>
        ) : null}
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[12px] text-zinc-600">
        {hasProject ? `${projects.length} proyecto(s) · ${files.length} archivos` : "sin proyecto"}
      </div>
    </div>
  );
}
