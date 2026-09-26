import type { PlanProposal } from "@shared/plan";
import { parseTasks } from "@shared/task-list";
import { cn } from "../lib/cn";

const NODE_HEIGHT = 40;
const NODE_GAP = 26;
const COLUMN_WIDTH = 360;

function sectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    const match = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (match) {
      inside = match[1].toLowerCase().includes(heading);
      continue;
    }
    if (inside) {
      const cleaned = line.replace(/^\s*[-*]\s+/, "").trim();
      if (cleaned) out.push(cleaned);
    }
  }
  return out;
}

/**
 * Grafo de tareas del plan: cada paso es un nodo conectado al siguiente, con
 * la intención y el pensamiento del harness alrededor.
 */
export function PlanCanvas({ plan }: { plan: PlanProposal }): React.ReactElement {
  const tasks = parseTasks(plan.markdown);
  const thinking = sectionLines(plan.markdown, "pensamiento");
  const checks = sectionLines(plan.markdown, "verificaci");
  const height = Math.max(NODE_HEIGHT, tasks.length * (NODE_HEIGHT + NODE_GAP) - NODE_GAP);
  const centerX = COLUMN_WIDTH / 2;

  return (
    <section className="flex flex-col gap-3" aria-label="Grafo del plan">
      <header className="rounded-panel border border-hairline bg-surface-raised/40 px-4 py-3">
        <p className="text-[14px] font-semibold text-zinc-100">{plan.title}</p>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          {plan.intent.domain} · {plan.intent.type} · effort {plan.intent.effort}
          {plan.files.length > 0 ? ` · ${plan.files.length} archivo(s)` : ""} · {tasks.length} tarea(s)
        </p>
      </header>

      {thinking.length > 0 ? (
        <div className="rounded-panel border border-hairline bg-surface-raised/30 px-4 py-3">
          <p className="text-[12px] font-medium text-harness-soft">Pensamiento</p>
          <ul className="mt-1 space-y-0.5">
            {thinking.map((line, index) => (
              <li key={index} className="text-[12px] leading-snug text-zinc-400">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-panel border border-hairline bg-surface/60 p-3">
        <svg width={COLUMN_WIDTH} height={height} role="img" aria-label="Tareas del plan conectadas" className="mx-auto block">
          {tasks.map((task, index) => {
            const y = index * (NODE_HEIGHT + NODE_GAP);
            const nextY = y + NODE_HEIGHT + NODE_GAP;
            return (
              <g key={task.id}>
                {index < tasks.length - 1 ? (
                  <line x1={centerX} y1={y + NODE_HEIGHT} x2={centerX} y2={nextY} stroke="#3f3f46" strokeWidth={1.5} markerEnd="" />
                ) : null}
                <rect
                  x={16}
                  y={y}
                  width={COLUMN_WIDTH - 32}
                  height={NODE_HEIGHT}
                  rx={10}
                  fill="color-mix(in srgb, var(--color-surface-raised) 85%, transparent)"
                  stroke="var(--color-hairline-strong)"
                />
                <circle cx={34} cy={y + NODE_HEIGHT / 2} r={10} fill="var(--color-harness)" />
                <text x={34} y={y + NODE_HEIGHT / 2 + 4} textAnchor="middle" className="fill-white" fontSize={11} fontWeight={600}>
                  {index + 1}
                </text>
                <text x={54} y={y + NODE_HEIGHT / 2 + 4} className="fill-zinc-200" fontSize={12}>
                  {task.label.length > 46 ? `${task.label.slice(0, 46)}…` : task.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-panel border border-hairline bg-surface-raised/30 px-4 py-3">
          <p className="text-[12px] font-medium text-zinc-400">Archivos a tocar</p>
          {plan.files.length === 0 ? (
            <p className="mt-1 text-[12px] text-zinc-600">sin archivos definidos</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {plan.files.map((file) => (
                <li key={file} className={cn("truncate font-mono text-[12px] text-zinc-400")}>
                  {file}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-panel border border-hairline bg-surface-raised/30 px-4 py-3">
          <p className="text-[12px] font-medium text-emerald-400">Verificación</p>
          {checks.length === 0 ? (
            <p className="mt-1 text-[12px] text-zinc-600">sin criterios</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {checks.map((line, index) => (
                <li key={index} className="text-[12px] leading-snug text-zinc-400">
                  ✓ {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
