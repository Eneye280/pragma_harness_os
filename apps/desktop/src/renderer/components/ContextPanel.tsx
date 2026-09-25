import { useState } from "react";
import type { HarnessContextSnapshot } from "@shared/context-snapshot";
import { cn } from "../lib/cn";
import { IconActivity, IconFile } from "./icons";

interface ContextPanelProps {
  snapshot: HarnessContextSnapshot | null;
  onOpenFile: (path: string) => void;
}

type SectionKey = "skills" | "rag" | "files" | "tokens" | "rules" | "instincts";

export function ContextPanel({ snapshot, onOpenFile }: ContextPanelProps): React.ReactElement {
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(["skills", "rag", "tokens"]));

  function toggle(section: SectionKey): void {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <IconActivity width={13} height={13} className="text-harness-soft" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Context</span>
        <span className={cn("ml-auto rounded-full px-1.5 py-[1px] text-[10px]", snapshot ? "bg-harness/10 text-harness-soft" : "bg-zinc-800 text-zinc-500")}>
          {snapshot ? "live" : "idle"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!snapshot ? (
          <div className="rounded-panel border border-hairline bg-surface-raised p-3">
            <p className="text-[11px] font-medium text-zinc-300">Harness inspector</p>
            <p className="mt-1 text-[11px] text-zinc-500">Envía un mensaje: aquí verás qué compiló el harness antes del agente.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Section
              label="Skills"
              summary={snapshot.skills.names.length > 0 ? snapshot.skills.names.join(", ") : "ninguna"}
              tone="harness"
              open={open.has("skills")}
              onToggle={() => toggle("skills")}
            >
              <p className="text-[11px] text-zinc-400">resueltas: {snapshot.skills.names.join(", ") || "—"}</p>
              <p className="text-[11px] text-zinc-500">compiladas: {snapshot.skills.sources.join(", ") || "—"}</p>
              <p className="text-[11px] text-zinc-600">{snapshot.skills.tokens} tokens</p>
            </Section>

            <Section
              label="RAG"
              summary={`${snapshot.rag.hits.length} hits · índice ${snapshot.rag.indexSize}`}
              open={open.has("rag")}
              onToggle={() => toggle("rag")}
            >
              {snapshot.rag.hits.length === 0 ? (
                <p className="text-[11px] text-zinc-500">sin coincidencias</p>
              ) : (
                <ul className="space-y-1">
                  {snapshot.rag.hits.map((hit) => (
                    <li key={hit.path}>
                      <button
                        type="button"
                        onClick={() => onOpenFile(hit.path)}
                        className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-left transition-colors hover:border-harness/40"
                      >
                        <span className="flex items-center gap-1.5">
                          <IconFile width={11} height={11} className="text-zinc-600" />
                          <span className="truncate font-mono text-[11px] text-zinc-300">{hit.path}</span>
                          <span className="ml-auto text-[10px] text-harness-soft">{hit.score}</span>
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-zinc-600">{hit.snippet.replace(/\s+/g, " ").slice(0, 90)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              label="Files"
              summary={`${snapshot.files.paths.length} prefetched`}
              open={open.has("files")}
              onToggle={() => toggle("files")}
            >
              {snapshot.files.paths.length === 0 ? (
                <p className="text-[11px] text-zinc-500">ninguno</p>
              ) : (
                <ul className="space-y-0.5">
                  {snapshot.files.paths.map((filePath) => (
                    <li key={filePath}>
                      <button
                        type="button"
                        onClick={() => onOpenFile(filePath)}
                        className="w-full truncate text-left font-mono text-[11px] text-zinc-400 transition-colors hover:text-harness-soft"
                      >
                        {filePath}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              label="Tokens"
              summary={`${(snapshot.tokens.used / 1000).toFixed(1)}k / ${(snapshot.tokens.limit / 1000).toFixed(0)}k`}
              tone="success"
              open={open.has("tokens")}
              onToggle={() => toggle("tokens")}
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, Math.round((snapshot.tokens.used / Math.max(1, snapshot.tokens.limit)) * 100))}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {snapshot.tokens.used} / {snapshot.tokens.limit} tokens · modelo {snapshot.model}
              </p>
            </Section>

            <Section
              label="Rules"
              summary={snapshot.rules.label}
              tone="harness"
              open={open.has("rules")}
              onToggle={() => toggle("rules")}
            >
              <p className="text-[11px] text-zinc-400">dominio {snapshot.rules.domain}</p>
              <p className="text-[11px] text-zinc-600">{snapshot.rules.tokens} tokens</p>
            </Section>

            <Section
              label="Instincts"
              summary={`${snapshot.instincts.items.length} applied`}
              open={open.has("instincts")}
              onToggle={() => toggle("instincts")}
            >
              {snapshot.instincts.items.length === 0 ? (
                <p className="text-[11px] text-zinc-500">ninguno con confidence ≥ 0.6</p>
              ) : (
                <ul className="space-y-1">
                  {snapshot.instincts.items.map((item) => (
                    <li key={item.trigger} className="rounded-control border border-hairline bg-surface px-2 py-1.5">
                      <p className="text-[11px] text-zinc-300">{item.trigger}</p>
                      <p className="text-[10px] text-zinc-500">{item.content}</p>
                      <p className="text-[10px] text-zinc-600">confidence {item.confidence.toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[10px] text-zinc-600">lo que el harness compila · pre-agent</div>
    </div>
  );
}

function Section({
  label,
  summary,
  tone = "default",
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  tone?: "default" | "harness" | "success";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-control border border-hairline bg-surface-raised/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left outline-none transition-colors hover:bg-zinc-800/40"
      >
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
        <span
          className={cn(
            "ml-auto truncate text-[11px]",
            tone === "harness" ? "text-harness-soft" : tone === "success" ? "text-emerald-400" : "text-zinc-300",
          )}
        >
          {summary}
        </span>
        <span className="text-zinc-600">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="border-t border-hairline px-2.5 py-2">{children}</div> : null}
    </div>
  );
}
