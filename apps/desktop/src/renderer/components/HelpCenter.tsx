import { useEffect, useMemo, useRef, useState } from "react";
import { searchHelp, type HelpTopic } from "@shared/help";
import { useFocusTrap } from "../shell/use-focus-trap";

interface HelpCenterProps {
  open: boolean;
  onClose: () => void;
  onOpenDoc: (doc: string) => void;
  onStartTour: () => void;
}

export function HelpCenter({ open, onClose, onOpenDoc, onStartTour }: HelpCenterProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const containerRef = useFocusTrap(open, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedId(null);
    }
  }, [open]);

  const topics = useMemo(() => searchHelp(query), [query]);
  const selected = topics.find((topic) => topic.id === selectedId) ?? topics[0] ?? null;

  if (!open) return null;

  function focusRelative(delta: number): void {
    if (topics.length === 0) return;
    const currentIndex = selected ? topics.findIndex((topic) => topic.id === selected.id) : -1;
    const nextIndex = (currentIndex + delta + topics.length) % topics.length;
    setSelectedId(topics[nextIndex].id);
    const buttons = listRef.current?.querySelectorAll("button");
    buttons?.[nextIndex]?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Centro de ayuda">
      <div ref={containerRef} className="sheet flex h-[70vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Ayuda</span>
          <button type="button" onClick={onStartTour} className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">
            Ver tour
          </button>
          <button type="button" onClick={onClose} className="ml-auto rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        <input
          value={query}
          autoFocus
          aria-label="Buscar en la ayuda"
          placeholder="buscar: sesiones, plugins, sandbox…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusRelative(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusRelative(-1);
            }
          }}
          className="mx-3 mt-3 rounded-control border border-hairline bg-surface px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-harness/60"
        />

        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] divide-x divide-hairline p-3">
          <ul ref={listRef} role="list" className="max-h-full space-y-1 overflow-y-auto pr-2">
            {topics.length === 0 ? <li className="text-[11px] text-zinc-500">sin resultados</li> : null}
            {topics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  aria-current={selected?.id === topic.id}
                  onClick={() => setSelectedId(topic.id)}
                  className={`w-full rounded-control border px-2 py-1.5 text-left text-[12px] transition-colors ${
                    selected?.id === topic.id ? "border-harness/50 bg-harness/10 text-harness-soft" : "border-hairline bg-surface text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {topic.title}
                </button>
              </li>
            ))}
          </ul>

          <div className="min-h-0 overflow-y-auto pl-3">
            {selected ? (
              <>
                <h3 className="text-[13px] font-medium text-zinc-100">{selected.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">{selected.body}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-800 px-2 py-[1px] text-[10px] text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
                {selected.doc ? (
                  <button
                    type="button"
                    onClick={() => onOpenDoc(selected.doc!)}
                    className="mt-4 rounded-control border border-harness/40 px-3 py-1.5 text-[11px] text-harness-soft transition-colors hover:bg-harness/10"
                  >
                    Abrir {selected.doc}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="text-[11px] text-zinc-500">Escribe para buscar en la ayuda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { HelpTopic };
