import { useState } from "react";
import type { SessionSummary } from "@shared/session";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../shell/use-focus-trap";
import { filterSessions, formatRelativeTime } from "../shell/session-utils";
import { IconClose } from "./icons";

interface SessionsPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionSummary[];
  currentSessionId: string;
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function SessionsPanel({
  open,
  onClose,
  sessions,
  currentSessionId,
  loading,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: SessionsPanelProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const containerRef = useFocusTrap(open, onClose);

  if (!open) return null;
  const visible = filterSessions(sessions, query);

  function commitRename(): void {
    if (editingId) onRename(editingId, editValue);
    setEditingId(null);
  }

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="presentation" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sessions-title"
        className="palette-anim absolute inset-y-0 left-0 flex w-[360px] flex-col border-r border-hairline bg-surface-raised shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-3">
          <span id="sessions-title" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Sesiones
          </span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-[1px] text-[10px] text-zinc-400">{sessions.length}</span>
          <button
            type="button"
            onClick={onNew}
            className="ml-auto rounded-control border border-harness/40 bg-harness/10 px-2 py-1 text-[11px] text-harness-soft transition-colors hover:bg-harness/20"
          >
            Nueva
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar sesiones"
            className="rounded-control p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <IconClose width={13} height={13} />
          </button>
        </div>

        <div className="border-b border-hairline px-3 py-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="buscar sesión"
            aria-label="Buscar sesión"
            className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60 placeholder:text-zinc-500"
          />
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {loading ? (
            <li className="px-2 py-3 text-[11px] text-zinc-500">cargando…</li>
          ) : visible.length === 0 ? (
            <li className="px-2 py-3 text-[11px] text-zinc-500">sin sesiones</li>
          ) : (
            visible.map((session) => {
              const isCurrent = session.id === currentSessionId;
              const isEditing = editingId === session.id;
              return (
                <li
                  key={session.id}
                  className={cn(
                    "rounded-control border px-2 py-2 transition-colors",
                    isCurrent ? "border-harness/40 bg-harness/10" : "border-hairline bg-surface hover:bg-zinc-800/60",
                  )}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      onBlur={commitRename}
                      aria-label="Nuevo título de la sesión"
                      className="w-full rounded-control border border-harness/40 bg-surface px-1.5 py-1 text-[12px] text-zinc-100 outline-none"
                    />
                  ) : (
                    <button type="button" onClick={() => onOpen(session.id)} className="block w-full text-left">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] text-zinc-200">{session.title}</span>
                        {isCurrent ? <span className="shrink-0 text-[10px] text-harness-soft">activa</span> : null}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-500">
                        {session.messageCount} msgs · {formatRelativeTime(session.updatedAt)}
                      </span>
                    </button>
                  )}
                  <div className="mt-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(session.id);
                        setEditValue(session.title);
                      }}
                      className="rounded-control px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      renombrar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(session.id)}
                      className="rounded-control px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-red-300"
                    >
                      borrar
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
