import { useState } from "react";
import type { QaProjectReport } from "@shared/qa";
import { cn } from "../lib/cn";
import { Dialog } from "../ui/Dialog";

/**
 * Verificación real del proyecto: corre build/tests (si hay package.json) y,
 * si es web, abre el HTML y captura pantalla + errores de consola.
 */
export function QaVerify({ disabled }: { disabled?: boolean }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<QaProjectReport | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    setOpen(true);
    setReport(null);
    try {
      const result = await window.harness?.qa.verifyProject();
      setReport(result ?? null);
    } catch {
      setReport({ ok: false, stack: "unknown", steps: [{ name: "qa", ok: false, detail: "falló la verificación" }], consoleErrors: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void run()}
        className="rounded-control border border-harness/40 bg-harness/10 px-2.5 py-1 text-[12px] text-harness-soft transition-colors hover:bg-harness/20 disabled:opacity-40"
      >
        {busy ? "Verificando…" : "Verificar (QA)"}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label="Verificación QA" maxWidth="52rem">
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span className="text-[14px] font-semibold text-zinc-100">Verificación QA</span>
          {report ? (
            <span className={cn("rounded-pill px-2 py-0.5 text-[12px]", report.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
              {report.ok ? "todo en verde" : "hay fallos"}
            </span>
          ) : null}
          {report ? <span className="text-[12px] text-zinc-500">stack: {report.stack}</span> : null}
          <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-control border border-hairline px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-surface-raised">
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {!report ? (
            <p className="py-8 text-center text-[13px] text-zinc-500">Ejecutando verificación real…</p>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-1.5">
                {report.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 rounded-control border border-hairline bg-surface px-3 py-2">
                    <span className={cn("mt-[1px] font-mono text-[12px]", step.ok ? "text-emerald-400" : "text-red-400")} aria-hidden="true">
                      {step.ok ? "✓" : "✕"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-zinc-200">
                        {step.name}
                        {step.durationMs ? <span className="ml-2 font-mono text-[12px] text-zinc-500">{step.durationMs}ms</span> : null}
                      </p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-zinc-400">{step.detail}</pre>
                    </div>
                  </li>
                ))}
              </ul>

              {report.consoleErrors.length > 0 ? (
                <div className="rounded-control border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <p className="text-[12px] font-medium text-amber-200">Errores de consola del navegador</p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-[12px] text-amber-200/90">{report.consoleErrors.join("\n")}</pre>
                </div>
              ) : null}

              {report.screenshotDataUrl ? (
                <figure className="overflow-hidden rounded-control border border-hairline bg-surface">
                  <img src={report.screenshotDataUrl} alt="Captura del HTML verificado" className="max-h-[420px] w-full object-contain" />
                  <figcaption className="border-t border-hairline px-3 py-1.5 font-mono text-[12px] text-zinc-500">evidencia: {report.screenshotPath ?? "captura"}</figcaption>
                </figure>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
          <span className="text-[12px] text-zinc-600">Ejecuta los scripts reales y abre el HTML en un navegador oculto.</span>
          <button type="button" onClick={() => void run()} disabled={busy} className="ml-auto rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong disabled:opacity-50">
            Correr de nuevo
          </button>
        </div>
      </Dialog>
    </>
  );
}
