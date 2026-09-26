import { useEffect, useState } from "react";
import type { BundleSummary } from "@shared/bundles";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../shell/use-focus-trap";

interface StackWizardProps {
  onSkip: () => void;
  onApplied: () => void;
}

export function StackWizard({ onSkip, onApplied }: StackWizardProps): React.ReactElement {
  const [bundles, setBundles] = useState<BundleSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useFocusTrap(true, onSkip);

  useEffect(() => {
    window.harness?.bundles
      .list()
      .then((list) => {
        setBundles(list);
        const suggested = list.find((bundle) => bundle.validation.ok)?.stack ?? null;
        setSelected(suggested);
      })
      .catch(() => setError("no se pudo cargar el catálogo de stacks"));
  }, []);

  async function apply(): Promise<void> {
    if (!selected) return;
    const bridge = window.harness?.bundles;
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const applied = await bridge.apply(selected);
      if (!applied.ok) {
        setError(applied.error ?? "no se pudo aplicar el stack");
        return;
      }
      await bridge.scaffold(selected);
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="presentation">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stack-wizard-title"
        className="palette-anim max-h-full w-full max-w-[560px] overflow-y-auto rounded-panel border border-harness/30 bg-surface-raised p-5 shadow-2xl shadow-black/60"
      >
        <h2 id="stack-wizard-title" className="text-[13px] font-semibold text-zinc-100">
          Proyecto nuevo: elige tu stack
        </h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          Esta carpeta está vacía. Elige un stack y el harness deja skills, agente y gates por defecto.
        </p>

        <div className="mt-4 space-y-1.5">
          {bundles.map((bundle) => (
            <button
              key={bundle.stack}
              type="button"
              onClick={() => setSelected(bundle.stack)}
              aria-pressed={selected === bundle.stack}
              className={cn(
                "flex w-full flex-col items-start rounded-control border px-3 py-2 text-left transition-colors",
                selected === bundle.stack ? "border-harness/50 bg-harness/10" : "border-hairline bg-surface hover:bg-zinc-800/60",
              )}
            >
              <span className="text-[12px] font-medium text-zinc-100">{bundle.label}</span>
              <span className="text-[12px] text-zinc-500">{bundle.description}</span>
              <span className="mt-1 font-mono text-[12px] text-zinc-500">
                agent {bundle.agent} · skills {bundle.skills.join(", ") || "—"}
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-[12px] text-red-400">{error}</p> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-control px-2 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Saltar
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => void apply()}
            className="ml-auto rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-harness-strong disabled:opacity-50"
          >
            {busy ? "Aplicando…" : "Aplicar stack"}
          </button>
        </div>
      </div>
    </div>
  );
}
