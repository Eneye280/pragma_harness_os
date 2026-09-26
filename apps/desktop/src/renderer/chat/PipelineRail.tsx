import { cn } from "../lib/cn";
import { buildTimeline } from "./pipeline";
import type { HarnessStepState } from "./chat-reducer";

const DOT: Record<string, string> = {
  done: "bg-emerald-400",
  running: "bg-harness animate-pulse",
  blocked: "bg-red-400",
  pending: "bg-zinc-700",
};

/**
 * Riel compacto del pipeline: marca en qué paso va la respuesta actual.
 * Se muestra junto al composer y refleja los pasos reales del run.
 */
export function PipelineRail({ steps, running }: { steps: HarnessStepState[]; running: boolean }): React.ReactElement | null {
  if (steps.length === 0) return null;
  const nodes = buildTimeline(steps);
  const reported = nodes.filter((node) => node.status !== "pending" || node.index <= currentIndex(nodes));
  const active = [...reported].reverse().find((node) => node.status === "running") ?? [...reported].reverse().find((node) => node.status === "done");

  return (
    <div className="mx-auto mb-2 flex w-full max-w-[780px] items-center gap-2 rounded-control border border-hairline bg-surface-raised/60 px-3 py-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", running ? "animate-pulse bg-harness" : "bg-emerald-400")} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {nodes.map((node) => (
          <span
            key={node.phase}
            title={`${node.title} — ${node.detail ?? node.status}`}
            className={cn("h-1.5 flex-1 rounded-pill", DOT[node.status] ?? "bg-zinc-700")}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="shrink-0 truncate text-[12px] text-zinc-400" title={active?.hint}>
        {active ? active.title : running ? "trabajando…" : "listo"}
      </span>
    </div>
  );
}

function currentIndex(nodes: ReturnType<typeof buildTimeline>): number {
  const last = [...nodes].reverse().find((node) => node.status !== "pending");
  return last ? last.index : -1;
}
