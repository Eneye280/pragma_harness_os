import { useState } from "react";
import { taskProgress, type MessageTask } from "@shared/task-list";

const STATUS: Record<MessageTask["status"], { icon: string; label: string; className: string }> = {
  pending: { icon: "○", label: "pendiente", className: "text-zinc-400" },
  "in-progress": { icon: "◐", label: "en curso", className: "text-harness-soft" },
  done: { icon: "●", label: "hecha", className: "text-emerald-400" },
  blocked: { icon: "✕", label: "bloqueada", className: "text-red-400" },
};

export function MessageTasks({ tasks }: { tasks: MessageTask[] }) {
  const [open, setOpen] = useState(false);
  const progress = taskProgress(tasks);
  const summary = `Tareas ${progress.done}/${progress.total}${progress.blocked > 0 ? ` · ${progress.blocked} bloqueadas` : ""}`;

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="rounded-control border border-hairline bg-surface-raised px-2 py-1 text-[12px] text-zinc-300 transition-colors hover:text-zinc-100"
      >
        {summary}
      </button>
      {open ? (
        <ul role="list" className="mt-1.5 space-y-1">
          {tasks.map((task) => {
            const status = STATUS[task.status];
            return (
              <li key={task.id} className="flex items-start gap-2 text-[12px]">
                <span aria-hidden="true" className={status.className}>
                  {status.icon}
                </span>
                <span className="text-zinc-300">{task.label}</span>
                <span className={`text-[12px] ${status.className}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
