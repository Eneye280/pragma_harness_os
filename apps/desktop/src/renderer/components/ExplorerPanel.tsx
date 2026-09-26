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
  const groups = groupSessionsByProject(sessions, activePath, recents);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleProject(path: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const hasProject = Boolean(activePath);

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <span className="text-label tracking-label text-zinc-400">Proyectos</span>
        <button
          type="button"
          onClick={onOpenFolder}
          disabled={openingFolder}
          aria-label="Abrir carpeta"
          title="Abrir carpeta…"
          className="ml-auto flex items-center gap-1.5 rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 transition-colors hover:border-harness/40 hover:text-zinc-100 disabled:opacity-40"
        >
          <IconFolder width={13} height={13} />
          abrir
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Proyectos (folders) → sesiones */}
        <ul className="space-y-0.5 px-2 py-2">
          {groups.length === 0 ? (
            <li className="rounded-panel border border-dashed border-hairline px-3 py-3 text-[12px] text-zinc-500">
              Sin proyectos. Abre una carpeta para empezar.
            </li>
          ) : null}
          {groups.map((group) => {
            const expanded = group.active || !collapsed.has(group.path);
            return (
              <li key={group.path}>
                <div
                  className={cn(
                    "group flex items-center gap-1.5 rounded-control px-1.5 py-1.5 transition-colors",
                    group.active ? "bg-harness/10" : "hover:bg-surface-raised/70",
                  )}
                >
                  <button
                    type="button"
                    aria-label={expanded ? `Colapsar ${group.name}` : `Expandir ${group.name}`}
                    onClick={() => toggleProject(group.path)}
                    className="flex h-5 w-4 shrink-0 items-center justify-center text-[12px] text-zinc-500 hover:text-zinc-200"
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPickRecent(group.path)}
                    title={group.path}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <IconFolder width={14} height={14} className={group.active ? "text-harness-soft" : "text-zinc-500"} />
                    <span className={cn("truncate text-[13px]", group.active ? "font-medium text-zinc-100" : "text-zinc-300")}>
                      {group.name}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-surface-raised px-1.5 text-[12px] text-zinc-500">
                      {group.sessions.length}
                    </span>
                  </button>
                  {group.active ? (
                    <button
                      type="button"
                      aria-label="Nueva sesión"
                      title="Nueva sesión en este proyecto"
                      onClick={onNewSession}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-control text-zinc-500 transition-colors hover:bg-harness/20 hover:text-harness-soft"
                    >
                      +
                    </button>
                  ) : null}
                </div>

                {expanded ? (
                  <ul className="mb-1 ml-[18px] space-y-0.5 border-l border-hairline pl-2">
                    {group.sessions.length === 0 ? (
                      <li className="px-2 py-1 text-[12px] text-zinc-600">{group.active ? "sin sesiones todavía" : "sin sesiones"}</li>
                    ) : null}
                    {group.sessions.map((session) => {
                      const isCurrent = session.id === currentSessionId && group.active;
                      const isRunning = runningSessions.includes(session.id);
                      return (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => (group.active ? onOpenSession(session.id) : onPickRecent(group.path))}
                            title={session.title}
                            className={cn(
                              "flex w-full items-center gap-1.5 rounded-control px-2 py-1 text-left text-[12px] transition-colors",
                              isCurrent ? "bg-harness/15 text-zinc-100" : "text-zinc-400 hover:bg-surface-raised/70 hover:text-zinc-200",
                            )}
                          >
                            {isRunning ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-harness" aria-hidden="true" /> : null}
                            <span className="truncate">{session.title}</span>
                            <span className="ml-auto shrink-0 font-mono text-[12px] text-zinc-600">{formatRelativeTime(session.updatedAt)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* Archivos del proyecto activo */}
        <div className="sticky top-0 z-[1] flex items-center gap-2 border-y border-hairline bg-surface/90 px-3 py-2 backdrop-blur">
          <span className="text-label tracking-label text-zinc-400">Archivos</span>
          <div className="field ml-auto flex items-center gap-1.5 px-2 py-1">
            <IconSearch width={12} height={12} className="text-zinc-500" aria-hidden="true" />
            <input
              value={explorer.search}
              onChange={(event) => explorer.setSearch(event.target.value)}
              placeholder="filtrar"
              aria-label="Filtrar archivos"
              className="w-[96px] bg-transparent text-[12px] text-zinc-200 outline-none"
            />
          </div>
        </div>

        <div className="px-2 py-2">
          {!hasProject ? (
            <EmptyNotice title="Sin proyecto abierto" body="Abre una carpeta: el harness trabaja siempre sobre un proyecto." />
          ) : explorer.loading ? (
            <p className="px-2 py-2 text-[12px] text-zinc-600">cargando…</p>
          ) : explorer.error ? (
            <EmptyNotice title="No se pudo abrir el proyecto" body={explorer.error} />
          ) : explorer.visibleNodes.length === 0 ? (
            <EmptyNotice title={explorer.search ? "Sin resultados" : "Carpeta vacía"} body={explorer.search ? `Nada coincide con “${explorer.search}”.` : "Este proyecto no tiene archivos visibles."} />
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
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[12px] text-zinc-600">
        {hasProject ? `${explorer.fileCount} archivos · watcher en vivo` : "sin proyecto"}
      </div>
    </div>
  );
}

function EmptyNotice({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div className="fade-in mx-1 rounded-panel border border-hairline bg-surface-raised p-3">
      <p className="text-[13px] font-medium text-zinc-200">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
