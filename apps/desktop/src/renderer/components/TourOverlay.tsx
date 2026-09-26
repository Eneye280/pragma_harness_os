import { advanceTour, completeTour, dismissStep, pendingSteps, type TourState, type TourStep } from "../shell/tour";

interface TourOverlayProps {
  state: TourState;
  steps: TourStep[];
  onChange: (next: TourState) => void;
}

export function TourOverlay({ state, steps, onChange }: TourOverlayProps): React.ReactElement | null {
  const pending = pendingSteps(state, steps);
  const step = steps[state.stepIndex] ?? pending[0];
  if (!step) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Tour contextual"
      className="sheet fixed bottom-4 right-4 z-40 w-[320px] p-3"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-harness-soft">
        Tour · {state.stepIndex + 1}/{steps.length}
      </p>
      <h3 className="mt-1 text-[13px] font-medium text-zinc-100">{step.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(dismissStep(state, steps))}
          className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 hover:bg-zinc-800"
        >
          Saltar paso
        </button>
        <button
          type="button"
          onClick={() => onChange(completeTour(state, steps))}
          className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 hover:bg-zinc-800"
        >
          No volver a mostrar
        </button>
        <button
          type="button"
          onClick={() => onChange(advanceTour(state, steps))}
          className="ml-auto rounded-control bg-harness px-3 py-1 text-[12px] font-medium text-white hover:bg-harness-strong"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
