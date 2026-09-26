import { useState } from "react";
import type { HarnessContextSnapshot } from "@shared/context-snapshot";
import { cn } from "../lib/cn";
import { CONTEXT_HELP, type ContextSectionHelp } from "../shell/context-help";
import { IconActivity, IconFile } from "./icons";
import { RagInspector } from "./RagInspector";
import { SkillEditor } from "./SkillEditor";

interface ContextPanelProps {
  snapshot: HarnessContextSnapshot | null;
  onOpenFile: (path: string) => void;
  onOpenSettings?: () => void;
}

type SectionKey = "skills" | "rag" | "files" | "tokens" | "rules" | "instincts";

export function ContextPanel({ snapshot, onOpenFile, onOpenSettings }: ContextPanelProps): React.ReactElement {
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(["skills", "rag", "tokens"]));
  const [skillEditorOpen, setSkillEditorOpen] = useState(false);
  const [ragStatus, setRagStatus] = useState<string | null>(null);
  const [ragBusy, setRagBusy] = useState(false);

  function toggle(section: SectionKey): void {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  async function reindex(mode: "full" | "incremental"): Promise<void> {
    const bridge = window.harness?.rag;
    if (!bridge) return;
    setRagBusy(true);
    setRagStatus(mode === "full" ? "reindexando todo…" : "actualizando índice…");
    try {
      await bridge.reindex(mode);
      setRagStatus(mode === "full" ? "índice reconstruido" : "índice actualizado");
    } catch {
      setRagStatus("no se pudo reindexar");
    } finally {
      setRagBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <IconActivity width={14} height={14} className="text-harness-soft" />
        <span className="text-label tracking-label text-zinc-400">Context</span>
        <span className={cn("ml-auto rounded-pill px-2 py-0.5 text-[12px]", snapshot ? "bg-harness/15 text-harness-soft" : "bg-surface-raised text-zinc-500")}>
          {snapshot ? "live" : "idle"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-[12px] leading-relaxed text-zinc-500">
          Lo que el harness compila para el agente. Puedes crear skills y reindexar RAG desde aquí.
        </p>

        {!snapshot ? (
          <div className="rounded-panel border border-hairline bg-surface-raised p-3">
            <p className="text-[13px] font-medium text-zinc-300">Sin snapshot todavía</p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">Envía un mensaje y aquí verás qué compiló el harness antes de despertar al agente.</p>
            <button
              type="button"
              onClick={() => setSkillEditorOpen(true)}
              className="mt-2 rounded-control border border-harness/40 bg-harness/10 px-2.5 py-1.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/20"
            >
              Nueva skill
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {snapshot.agent ? (
              <div className="rounded-control border border-harness/30 bg-harness/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-harness-soft">{CONTEXT_HELP.agent.title}</span>
                  <span className="ml-auto text-[12px] text-zinc-400">{snapshot.agent.name}</span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-zinc-500">{CONTEXT_HELP.agent.description}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="font-mono text-[12px] text-zinc-500">{snapshot.agent.id}</code>
                  {onOpenSettings ? (
                    <button type="button" onClick={onOpenSettings} className="ml-auto rounded-control border border-hairline px-2 py-0.5 text-[12px] text-zinc-400 hover:text-zinc-100">
                      {CONTEXT_HELP.agent.action}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Section
              help={CONTEXT_HELP.skills}
              summary={snapshot.skills.names.length > 0 ? snapshot.skills.names.join(", ") : "ninguna"}
              tone="harness"
              open={open.has("skills")}
              onToggle={() => toggle("skills")}
              actions={
                <button
                  type="button"
                  onClick={() => setSkillEditorOpen(true)}
                  className="rounded-control border border-harness/40 bg-harness/10 px-2 py-0.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/20"
                >
                  {CONTEXT_HELP.skills.action}
                </button>
              }
            >
              <p className="text-[12px] text-zinc-400">resueltas: {snapshot.skills.names.join(", ") || "—"}</p>
              <p className="text-[12px] text-zinc-500">compiladas: {snapshot.skills.sources.join(", ") || "—"}</p>
              <p className="text-[12px] text-zinc-600">{snapshot.skills.tokens} tokens</p>
            </Section>

            <Section
              help={CONTEXT_HELP.rag}
              summary={`${snapshot.rag.hits.length} hits · índice ${snapshot.rag.indexSize}`}
              open={open.has("rag")}
              onToggle={() => toggle("rag")}
            >
              {snapshot.rag.hits.length === 0 ? (
                <p className="mb-2 text-[12px] text-zinc-500">sin coincidencias</p>
              ) : (
                <ul className="mb-2 space-y-1">
                  {snapshot.rag.hits.map((hit) => (
                    <li key={hit.path}>
                      <button
                        type="button"
                        onClick={() => onOpenFile(hit.path)}
                        className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-left transition-colors hover:border-harness/40"
                      >
                        <span className="flex items-center gap-1.5">
                          <IconFile width={12} height={12} className="text-zinc-600" />
                          <span className="truncate font-mono text-[12px] text-zinc-300">{hit.path}</span>
                          <span className="ml-auto text-[12px] text-harness-soft">{hit.score}</span>
                        </span>
                        <span className="mt-1 block truncate text-[12px] text-zinc-600">{hit.snippet.replace(/\s+/g, " ").slice(0, 90)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={ragBusy}
                  onClick={() => void reindex("incremental")}
                  className="rounded-control border border-harness/40 bg-harness/10 px-2 py-0.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/20 disabled:opacity-50"
                >
                  {CONTEXT_HELP.rag.action}
                </button>
                <button
                  type="button"
                  disabled={ragBusy}
                  onClick={() => void reindex("full")}
                  className="rounded-control border border-hairline px-2 py-0.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
                >
                  Reindexar todo
                </button>
                {ragStatus ? <span className="text-[12px] text-zinc-500">{ragStatus}</span> : null}
              </div>
            </Section>

            <Section
              help={CONTEXT_HELP.files}
              summary={`${snapshot.files.paths.length} prefetched`}
              open={open.has("files")}
              onToggle={() => toggle("files")}
            >
              {snapshot.files.paths.length === 0 ? (
                <p className="text-[12px] text-zinc-500">ninguno</p>
              ) : (
                <ul className="space-y-0.5">
                  {snapshot.files.paths.map((filePath) => (
                    <li key={filePath}>
                      <button type="button" onClick={() => onOpenFile(filePath)} className="w-full truncate text-left font-mono text-[12px] text-zinc-400 transition-colors hover:text-harness-soft">
                        {filePath}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              help={CONTEXT_HELP.tokens}
              summary={`${(snapshot.tokens.used / 1000).toFixed(1)}k / ${(snapshot.tokens.limit / 1000).toFixed(0)}k`}
              tone="success"
              open={open.has("tokens")}
              onToggle={() => toggle("tokens")}
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.round((snapshot.tokens.used / Math.max(1, snapshot.tokens.limit)) * 100))}%` }} />
              </div>
              <p className="mt-1 text-[12px] text-zinc-500">
                {snapshot.tokens.used} / {snapshot.tokens.limit} tokens · modelo {snapshot.model}
              </p>
            </Section>

            <Section help={CONTEXT_HELP.rules} summary={snapshot.rules.label} tone="harness" open={open.has("rules")} onToggle={() => toggle("rules")}>
              <p className="text-[12px] text-zinc-400">dominio {snapshot.rules.domain}</p>
              <p className="text-[12px] text-zinc-600">{snapshot.rules.tokens} tokens</p>
            </Section>

            <Section help={CONTEXT_HELP.instincts} summary={`${snapshot.instincts.items.length} applied`} open={open.has("instincts")} onToggle={() => toggle("instincts")}>
              {snapshot.instincts.items.length === 0 ? (
                <p className="text-[12px] text-zinc-500">Ninguno con confianza ≥ 0.6. Se generan solos tras runs con errores y arreglos.</p>
              ) : (
                <ul className="space-y-1">
                  {snapshot.instincts.items.map((item) => (
                    <li key={item.trigger} className="rounded-control border border-hairline bg-surface px-2 py-1.5">
                      <p className="text-[12px] text-zinc-300">{item.trigger}</p>
                      <p className="text-[12px] text-zinc-500">{item.content}</p>
                      <p className="text-[12px] text-zinc-600">confidence {item.confidence.toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        <div className="mt-2">
          <RagInspector onOpenFile={onOpenFile} />
        </div>
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[12px] text-zinc-600">compilado antes del agente · pre-agent</div>

      <SkillEditor open={skillEditorOpen} initialName={null} onClose={() => setSkillEditorOpen(false)} onSaved={() => setSkillEditorOpen(false)} />
    </div>
  );
}

function Section({
  help,
  summary,
  tone = "default",
  open,
  onToggle,
  actions,
  children,
}: {
  help: ContextSectionHelp;
  summary: string;
  tone?: "default" | "harness" | "success";
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-control border border-hairline bg-surface-raised/60">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-raised">
        <span className="text-[13px] font-medium text-zinc-300">{help.title}</span>
        <span className={cn("ml-auto truncate text-[12px]", tone === "harness" ? "text-harness-soft" : tone === "success" ? "text-emerald-400" : "text-zinc-400")}>{summary}</span>
        <span className="text-zinc-500" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="border-t border-hairline px-2.5 py-2">
          <p className="mb-2 text-[12px] leading-snug text-zinc-500">{help.description}</p>
          {children}
          {actions ? <div className="mt-2 flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
