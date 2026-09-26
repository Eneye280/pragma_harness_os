import { useEffect, useState } from "react";
import type { PlanProposal } from "@shared/plan";
import { MarkdownView } from "../chat/MarkdownView";

interface PlanChatCardProps {
  plan: PlanProposal;
  onApprove: (markdown: string) => void;
  onRevise: (markdown: string) => void;
  onDiscard: () => void;
}

/**
 * Aprobación del plan dentro del mismo chat (no reemplaza la conversación).
 * Se puede editar el markdown antes de aprobar.
 */
export function PlanChatCard({ plan, onApprove, onRevise, onDiscard }: PlanChatCardProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.markdown);

  useEffect(() => {
    setDraft(plan.markdown);
    setEditing(false);
  }, [plan.markdown]);

  return (
    <section className="glass-strong overflow-hidden rounded-sheet" aria-label="Plan propuesto">
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-harness/20 text-[12px] text-harness-soft" aria-hidden="true">
          ⌘
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100">Plan propuesto{plan.revised ? " (revisado)" : ""}</p>
          <p className="truncate text-[12px] text-zinc-500">
            {plan.intent.domain} · {plan.intent.type} · effort {plan.intent.effort}
            {plan.files.length > 0 ? ` · ${plan.files.length} archivo(s)` : ""}
          </p>
        </div>
        <span className="ml-auto rounded-pill border border-harness/40 bg-harness/10 px-2 py-0.5 text-[12px] text-harness-soft">requiere aprobación</span>
      </header>

      <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
        {editing ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Editar plan"
            className="field h-[280px] w-full resize-y px-3 py-2 font-mono text-[12px] text-zinc-200"
          />
        ) : (
          <MarkdownView text={plan.markdown} />
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => {
                onRevise(draft);
                setEditing(false);
              }}
              className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong"
            >
              Guardar cambios
            </button>
            <button type="button" onClick={() => { setEditing(false); setDraft(plan.markdown); }} className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-surface-raised">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onApprove(plan.markdown)}
              className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong"
            >
              Aprobar y ejecutar
            </button>
            <button type="button" onClick={() => setEditing(true)} className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-surface-raised">
              Editar plan
            </button>
            <button type="button" onClick={onDiscard} className="rounded-control border border-red-500/40 px-3 py-1.5 text-[12px] text-red-300 hover:bg-red-500/10">
              Descartar
            </button>
          </>
        )}
        <span className="ml-auto text-[12px] text-zinc-600">El harness no ejecuta hasta que apruebes.</span>
      </footer>
    </section>
  );
}
