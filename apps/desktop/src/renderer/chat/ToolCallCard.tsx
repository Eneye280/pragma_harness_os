import { useState } from "react";
import { cn } from "../lib/cn";
import { DiffView } from "./DiffView";
import type { ToolCallState } from "./chat-reducer";
import { IconFile, IconSend } from "../components/icons";

const STATUS_STYLES: Record<ToolCallState["status"], { dot: string; label: string }> = {
  running: { dot: "bg-harness animate-pulse", label: "running" },
  done: { dot: "bg-emerald-500", label: "done" },
  error: { dot: "bg-red-500", label: "error" },
};

export function ToolCallCard({ call }: { call: ToolCallState }): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const status = STATUS_STYLES[call.status];

  return (
    <div className="overflow-hidden rounded-panel border border-hairline bg-surface-raised">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none transition-colors hover:bg-zinc-800/40 focus-visible:ring-1 focus-visible:ring-harness"
      >
        <span className="text-zinc-500">{call.tool === "terminal" ? <IconSend width={13} height={13} /> : <IconFile width={13} height={13} />}</span>
        <span className="font-mono text-[11.5px] text-zinc-300">{call.summary}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] uppercase tracking-widest text-zinc-500">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
        <span className="text-zinc-600">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (call.diff || call.output) ? (
        <div className="border-t border-hairline px-2 py-2">
          {call.diff ? <DiffView diff={call.diff} /> : null}
          {call.output ? (
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-control bg-black/30 px-3 py-2 font-mono text-[11.5px] text-zinc-400">
              {call.output}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
