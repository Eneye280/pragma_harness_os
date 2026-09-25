import { cn } from "../lib/cn";
import type { HarnessStepState } from "./chat-reducer";

const STATUS_DOT: Record<HarnessStepState["status"], string> = {
  running: "bg-harness animate-pulse",
  done: "bg-emerald-500",
  blocked: "bg-red-500",
};

export function HarnessStrip({ steps, running }: { steps: HarnessStepState[]; running: boolean }): React.ReactElement | null {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-panel border border-harness/25 bg-harness/5 px-3 py-2">
      <span className="mr-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">
        {running ? "◐ Harness" : "✓ Harness"}
      </span>
      {steps.map((step) => (
        <span
          key={step.phase}
          title={step.detail}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface-raised px-2.5 py-1 text-[11px] text-zinc-400"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[step.status])} />
          {step.label}
        </span>
      ))}
    </div>
  );
}
