import { IconActivity } from "./icons";

interface InspectorRow {
  label: string;
  value: string;
  tone?: "default" | "harness" | "success";
}

const INSPECTOR_ROWS: InspectorRow[] = [
  { label: "Skills", value: "tdd-workflow, security-review", tone: "harness" },
  { label: "RAG", value: "5 hits · docs/auth.md", tone: "default" },
  { label: "Files", value: "4 prefetched", tone: "default" },
  { label: "Tokens", value: "4.2k / 8k", tone: "success" },
  { label: "Rules", value: "G1–G10 + backend", tone: "harness" },
  { label: "Instincts", value: "2 applied", tone: "default" },
];

export function ContextPanel(): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <IconActivity width={13} height={13} className="text-harness-soft" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Context</span>
        <span className="ml-auto rounded-full bg-harness/10 px-1.5 py-[1px] text-[10px] text-harness-soft">live</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="rounded-panel border border-hairline bg-surface-raised p-3">
          <p className="text-[11px] font-medium text-zinc-300">Harness inspector</p>
          <p className="mt-1 text-[11px] text-zinc-500">Lo que el harness compila antes del agente.</p>
        </div>

        <ul className="mt-3 space-y-1.5">
          {INSPECTOR_ROWS.map((row) => (
            <li key={row.label} className="rounded-control border border-hairline bg-surface-raised/60 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">{row.label}</span>
                <span
                  className={
                    row.tone === "harness"
                      ? "text-[11px] text-harness-soft"
                      : row.tone === "success"
                        ? "text-[11px] text-emerald-400"
                        : "text-[11px] text-zinc-300"
                  }
                >
                  {row.value}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-hairline px-3 py-2 text-[10px] text-zinc-600">Inspector en vivo · TASK 24</div>
    </div>
  );
}
