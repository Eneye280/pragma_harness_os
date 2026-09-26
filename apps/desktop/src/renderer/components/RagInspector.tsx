import { useEffect, useState } from "react";
import type { RagProgressEvent, RagRecallHit, RagStats } from "@shared/rag";
import { IconFile } from "./icons";

export function RagInspector({ onOpenFile }: { onOpenFile: (path: string) => void }): React.ReactElement {
  const [stats, setStats] = useState<RagStats | null>(null);
  const [hits, setHits] = useState<RagRecallHit[]>([]);
  const [progress, setProgress] = useState<RagProgressEvent | null>(null);
  const [query, setQuery] = useState("");
  const [excludesText, setExcludesText] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const next = await window.harness?.rag.stats();
    if (next) {
      setStats(next);
      setExcludesText((current) => (current === "" ? next.excludes.join(", ") : current));
    }
  }

  useEffect(() => {
    void refresh();
    const off = window.harness?.rag.onProgress((event) => setProgress(event));
    return () => off?.();
  }, []);

  async function reindex(mode: "full" | "incremental"): Promise<void> {
    setBusy(true);
    setProgress({ processed: 0, total: 0, done: false });
    try {
      await window.harness?.rag.reindex(mode);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveExcludes(): Promise<void> {
    const excludes = excludesText
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const result = await window.harness?.rag.setExcludes(excludes);
    if (result?.ok) {
      await window.harness?.rag.reindex("full");
      await refresh();
    }
  }

  async function runQuery(): Promise<void> {
    if (!query.trim()) return;
    const result = await window.harness?.rag.recall(query.trim(), 5);
    setHits(result?.hits ?? []);
  }

  return (
    <div className="glass rounded-control">
      <div className="flex items-center gap-2 border-b border-hairline px-2.5 py-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">RAG Inspector</span>
        <span className="ml-auto text-[10px] text-zinc-400">{stats ? `${stats.size} docs` : "—"}</span>
      </div>
      <div className="space-y-2 px-2.5 py-2">
        {progress && !progress.done ? (
          <p className="text-[10px] text-harness-soft" role="status">
            indexando {progress.processed}/{progress.total}…
          </p>
        ) : null}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void reindex("incremental")}
            disabled={busy}
            className="rounded-control border border-hairline px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            Reindex incremental
          </button>
          <button
            type="button"
            onClick={() => void reindex("full")}
            disabled={busy}
            className="rounded-control border border-hairline px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            Reindex full
          </button>
        </div>

        <label className="block text-[10px] text-zinc-500">
          Excluir rutas (glob, separadas por coma)
          <textarea
            value={excludesText}
            aria-label="Excluir rutas del RAG"
            onChange={(event) => setExcludesText(event.target.value)}
            rows={1}
            className="mt-1 w-full resize-y rounded-control border border-hairline bg-surface px-2 py-1 font-mono text-[10px] text-zinc-300 outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveExcludes()}
          className="rounded-control border border-harness/40 px-2 py-1 text-[10px] text-harness-soft transition-colors hover:bg-harness/10"
        >
          Guardar exclusiones
        </button>

        <div className="flex items-center gap-1.5">
          <input
            value={query}
            aria-label="Probar consulta RAG"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runQuery();
            }}
            placeholder="probar consulta…"
            className="min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2 py-1 text-[10px] text-zinc-300 outline-none"
          />
          <button
            type="button"
            onClick={() => void runQuery()}
            className="rounded-control border border-hairline px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Buscar
          </button>
        </div>

        {hits.length > 0 ? (
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.path}-${hit.score}`}>
                <button
                  type="button"
                  onClick={() => onOpenFile(hit.path)}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1 text-left transition-colors hover:border-harness/40"
                >
                  <span className="flex items-center gap-1.5">
                    <IconFile width={11} height={11} className="text-zinc-600" />
                    <span className="truncate font-mono text-[10px] text-zinc-300">{hit.path}</span>
                    <span className="ml-auto text-[10px] text-harness-soft">{hit.score}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-zinc-600">{hit.snippet.slice(0, 90)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {stats ? (
          <details className="text-[10px] text-zinc-500">
            <summary className="cursor-pointer">documentos indexados ({stats.documents.length})</summary>
            <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
              {stats.documents.map((document) => (
                <li key={document.path}>
                  <button
                    type="button"
                    onClick={() => onOpenFile(document.path)}
                    className="w-full truncate text-left font-mono text-[10px] text-zinc-500 transition-colors hover:text-harness-soft"
                  >
                    {document.path} · {document.chars}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
