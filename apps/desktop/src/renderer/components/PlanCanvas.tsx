import { useEffect, useState } from "react";
import type { PlanProposal } from "@shared/plan";
import { addStep, buildPartialApproval, moveStep, parsePlanSteps, removeStep, setStepIncluded } from "@shared/plan-editor";
import { MarkdownView } from "../chat/MarkdownView";
import { IconFile } from "./icons";

interface PlanCanvasProps {
  plan: PlanProposal;
  onApprove: (markdown: string) => void;
  onRevise: (markdown: string) => void;
  onDiscard: () => void;
}

export function PlanCanvas({ plan, onApprove, onRevise, onDiscard }: PlanCanvasProps): React.ReactElement {
  const [draft, setDraft] = useState(plan.markdown);
  const [newStep, setNewStep] = useState("");

  useEffect(() => {
    setDraft(plan.markdown);
  }, [plan.createdAt, plan.markdown]);

  const edited = draft !== plan.markdown;
  const steps = parsePlanSteps(draft);
  const included = steps.filter((step) => step.included).length;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Plan Canvas</span>
        <span className="text-[11px] text-zinc-500">{plan.intent.domain}/{plan.intent.effort}</span>
        {plan.revised ? <span className="rounded-full bg-amber-500/15 px-2 py-[1px] text-[10px] text-amber-400">recompilado</span> : null}
        {edited ? <span className="rounded-full bg-harness/15 px-2 py-[1px] text-[10px] text-harness-soft">editado</span> : null}
        {steps.length > 0 ? <span className="text-[10px] text-zinc-500">{included} de {steps.length} pasos</span> : null}
      </div>

      {steps.length > 0 ? (
        <div className="max-h-40 overflow-y-auto border-b border-hairline px-3 py-2" aria-label="Pasos del plan">
          <ul role="list" className="space-y-1">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={step.included}
                  aria-label={`Incluir ${step.label}`}
                  onChange={(event) => setDraft((current) => setStepIncluded(current, step.id, event.target.checked))}
                />
                <span className={step.included ? "text-zinc-300" : "text-zinc-600 line-through"}>{step.label}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => setDraft((current) => moveStep(current, step.id, -1))} disabled={index === 0} aria-label={`Subir ${step.label}`} className="rounded-control border border-hairline px-1.5 text-zinc-500 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => setDraft((current) => moveStep(current, step.id, 1))} disabled={index === steps.length - 1} aria-label={`Bajar ${step.label}`} className="rounded-control border border-hairline px-1.5 text-zinc-500 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => setDraft((current) => removeStep(current, step.id))} aria-label={`Quitar ${step.label}`} className="rounded-control border border-hairline px-1.5 text-zinc-500">✕</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newStep}
              onChange={(event) => setNewStep(event.target.value)}
              placeholder="Nuevo paso…"
              aria-label="Nuevo paso"
              className="min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2 py-1 text-[11px] text-zinc-300 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setDraft((current) => addStep(current, newStep));
                setNewStep("");
              }}
              className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800"
            >
              Añadir paso
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-hairline">
        <div className="flex min-h-0 flex-col">
          <p className="border-b border-hairline px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-600">Markdown (editable)</p>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-surface px-3 py-3 font-mono text-[12px] leading-relaxed text-zinc-300 outline-none"
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <p className="border-b border-hairline px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-600">Preview</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <MarkdownView text={draft} />
            <div className="mt-4 rounded-panel border border-hairline bg-surface-raised p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Archivos a tocar</p>
              <ul className="mt-2 space-y-1">
                {plan.files.map((file) => (
                  <li key={file} className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <IconFile width={12} height={12} className="text-zinc-600" />
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
        <p className="text-[11px] text-zinc-600">El agente no ejecuta hasta que apruebes el plan.</p>
        <button
          type="button"
          onClick={() => onRevise(draft)}
          className="ml-auto rounded-control border border-hairline px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Recompilar
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-control border border-red-500/40 px-3 py-1.5 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={() => onApprove(buildPartialApproval(draft).markdown)}
          className="rounded-control border border-harness/50 px-3 py-1.5 text-[11px] text-harness-soft transition-colors hover:bg-harness/10"
        >
          Aprobar seleccionados
        </button>
        <button
          type="button"
          onClick={() => onApprove(draft)}
          className="rounded-control bg-harness px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-harness-strong"
        >
          Aprobar
        </button>
      </div>
    </div>
  );
}
