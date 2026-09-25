import { IconSend, IconSparkles } from "./icons";

const HARNESS_STEPS = ["clasificando…", "compilando skills…", "RAG 5 hits", "presupuesto ok"];

export function ChatPanel(): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5 px-6 py-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-harness/15 text-harness-soft">
              <IconSparkles width={18} height={18} />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Harness Controls. Agent Executes.</h1>
              <p className="text-[12px] text-zinc-500">El harness compila reglas, skills, RAG y contexto antes de despertar al agente.</p>
            </div>
          </div>

          <div className="rounded-panel border border-hairline bg-surface-raised p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Harness compile</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-harness/30 bg-harness/10 px-2.5 py-1 text-[11px] text-harness-soft">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-harness" />
                ◐ Harness
              </span>
              {HARNESS_STEPS.map((step) => (
                <span key={step} className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400">
                  {step}
                </span>
              ))}
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400">gates pre ok</span>
            </div>
          </div>

          <div className="rounded-panel border border-hairline bg-surface-raised p-4">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              Shell listo. El chat con streaming, tool call cards y diffs inline llega en <span className="text-harness-soft">TASK 19</span>.
            </p>
            <p className="mt-2 text-[12px] text-zinc-500">
              Atajos activos: <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">Ctrl/Cmd+B</kbd> explorer ·{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">Ctrl/Cmd+Shift+C</kbd> context ·{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">Ctrl/Cmd+K</kbd> palette
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-hairline bg-surface px-6 py-4">
        <div className="mx-auto flex w-full max-w-[780px] items-end gap-2 rounded-panel border border-hairline bg-surface-raised p-2 focus-within:border-harness/50">
          <textarea
            rows={1}
            disabled
            placeholder="Escribe un mensaje… (habilitado en TASK 19)"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-control bg-harness/40 text-white/70 disabled:cursor-not-allowed"
          >
            <IconSend width={15} height={15} />
          </button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-[780px] text-[10px] text-zinc-600">
          Enter envía · Shift+Enter salto de línea · doble Esc cierra el palette
        </p>
      </div>
    </div>
  );
}
