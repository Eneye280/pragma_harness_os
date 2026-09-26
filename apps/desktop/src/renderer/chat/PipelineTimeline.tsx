import { useState } from "react";
import { cn } from "../lib/cn";
import { buildTimeline, timelineProgress, type TimelineNode } from "./pipeline";
import type { HarnessStepState } from "./chat-reducer";

const STATUS_STYLE: Record<TimelineNode["status"], string> = {
  done: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  running: "border-harness/60 bg-harness/20 text-harness-soft",
  blocked: "border-red-500/50 bg-red-500/15 text-red-300",
  pending: "border-hairline bg-surface text-zinc-500",
};

const STATUS_GLYPH: Record<TimelineNode["status"], string> = {
  done: "✓",
  running: "◐",
  blocked: "✕",
  pending: "",
};

export function PipelineTimeline({ steps, running }: { steps: HarnessStepState[]; running: boolean }): React.ReactElement | null {
  const [open, setOpen] = useState(true);
  if (steps.length === 0) return null;

  const nodes = buildTimeline(steps);
  const progress = timelineProgress(nodes);

  return (
    <section className="glass overflow-hidden rounded-sheet" aria-label="Pipeline del harness">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-raised/40"
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", running ? "animate-pulse bg-harness" : "bg-emerald-400")} aria-hidden="true" />
        <span className="text-[13px] font-medium text-zinc-100">Pipeline del harness</span>
        <span className="text-[12px] text-zinc-500">{running ? "en curso" : "completado"}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-raised">
            <span className="block h-full rounded-full bg-harness transition-all" style={{ width: `${progress}%` }} />
          </span>
          <span className="font-mono text-[12px] text-zinc-400">{progress}%</span>
          <span className="text-[12px] text-zinc-500" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open ? (
        <ol className="relative space-y-0 px-3.5 pb-3.5 pt-1">
          {nodes.map((node, index) => {
            const isLast = index === nodes.length - 1;
            return (
              <li key={node.phase} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]",
                      STATUS_STYLE[node.status],
                    )}
                    aria-hidden="true"
                  >
                    {STATUS_GLYPH[node.status] || node.index + 1}
                  </span>
                  {!isLast ? <span className={cn("mt-1 w-px flex-1", node.status === "done" ? "bg-emerald-500/40" : node.status === "blocked" ? "bg-red-500/40" : "bg-hairline")} /> : null}
                </div>
                <div className={cn("min-w-0 flex-1 pt-0.5", node.status === "pending" ? "opacity-60" : "")}>
                  <p className="text-[13px] text-zinc-200">{node.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{node.detail || node.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
