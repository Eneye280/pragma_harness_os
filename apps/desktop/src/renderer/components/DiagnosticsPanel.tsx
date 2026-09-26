import { useEffect, useState } from "react";
import { useFocusTrap } from "../shell/use-focus-trap";

interface DiagnosticsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

const TONE: Record<Check["status"], string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  fail: "text-red-400",
};

export function DiagnosticsPanel({ open, onClose }: DiagnosticsPanelProps): React.ReactElement | null {
  const [checks, setChecks] = useState<Check[]>([]);
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useFocusTrap(open, onClose);

  async function refresh(): Promise<void> {
    const result = await window.harness?.diagnostics.get();
    if (!result) return;
    setChecks(result.checks);
    setReport(result.report);
  }

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    void refresh();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Diagnóstico">
      <div ref={containerRef} className="sheet flex h-[76vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Diagnóstico / health</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(report).then(() => setCopied(true)).catch(() => setCopied(false));
            }}
            className="ml-auto rounded-control border border-harness/40 px-2 py-1 text-[11px] text-harness-soft hover:bg-harness/10"
          >
            {copied ? "Copiado" : "Copiar reporte"}
          </button>
          <button
            type="button"
            onClick={() => void window.harness?.diagnostics.repairRag().then(() => refresh())}
            className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
          >
            Reparar índice
          </button>
          <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {checks.map((check) => (
              <li key={check.id} className="card flex items-center gap-3 px-3 py-2">
                <span className={`font-mono text-[10px] ${TONE[check.status]}`}>{check.status.toUpperCase()}</span>
                <span className="w-28 shrink-0 text-[12px] text-zinc-300">{check.label}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500" title={check.detail}>{check.detail}</span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[10px] uppercase tracking-widest text-zinc-500">reporte (sin secretos)</p>
          <textarea
            readOnly
            aria-label="Reporte de diagnóstico"
            value={report}
            className="mt-1 h-40 w-full resize-y rounded-control border border-hairline bg-surface px-2 py-1 font-mono text-[10px] text-zinc-300 outline-none"
          />
        </div>
      </div>
    </div>
  );
}
