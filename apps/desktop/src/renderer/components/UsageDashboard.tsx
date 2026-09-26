import { useEffect, useMemo, useState } from "react";
import { aggregateUsage, type UsageComparison, type UsageEntry } from "@shared/usage";
import { useFocusTrap } from "../shell/use-focus-trap";
import { TelemetryCharts } from "./TelemetryCharts";

interface UsageDashboardProps {
  open: boolean;
  onClose: () => void;
}

const RANGES: Array<{ id: string; label: string; days: number | null }> = [
  { id: "7", label: "7 días", days: 7 },
  { id: "30", label: "30 días", days: 30 },
  { id: "all", label: "todo", days: null },
];

export function UsageDashboard({ open, onClose }: UsageDashboardProps): React.ReactElement | null {
  const [rangeId, setRangeId] = useState("7");
  const [groupBy, setGroupBy] = useState<"day" | "session" | "project">("day");
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [comparison, setComparison] = useState<UsageComparison | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const containerRef = useFocusTrap(open, onClose);

  useEffect(() => {
    if (!open) return;
    const range = RANGES.find((entry) => entry.id === rangeId);
    const fromTs = range?.days ? Date.now() - range.days * 24 * 60 * 60 * 1000 : undefined;
    void window.harness?.usage.get({ fromTs }).then((result) => {
      if (!result) return;
      setEntries(result.entries);
      setComparison(result.comparison);
    });
  }, [open, rangeId]);

  const buckets = useMemo(() => aggregateUsage(entries, groupBy), [entries, groupBy]);

  if (!open) return null;

  const maxTokens = Math.max(1, ...buckets.map((bucket) => bucket.tokens));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Dashboard de uso">
      <div ref={containerRef} className="sheet flex h-[78vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Uso</span>
          <select aria-label="Rango de uso" value={rangeId} onChange={(event) => setRangeId(event.target.value)} className="rounded-control border border-hairline bg-surface px-2 py-1 text-[11px] text-zinc-300 outline-none">
            {RANGES.map((range) => (
              <option key={range.id} value={range.id}>{range.label}</option>
            ))}
          </select>
          <select aria-label="Agrupar por" value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className="rounded-control border border-hairline bg-surface px-2 py-1 text-[11px] text-zinc-300 outline-none">
            <option value="day">por día</option>
            <option value="session">por sesión</option>
            <option value="project">por proyecto</option>
          </select>
          <button
            type="button"
            onClick={() => void window.harness?.usage.csv(groupBy).then((result) => setCsv(result?.csv ?? ""))}
            className="rounded-control border border-harness/40 px-2 py-1 text-[11px] text-harness-soft hover:bg-harness/10"
          >
            Exportar CSV
          </button>
          <button type="button" onClick={onClose} className="ml-auto rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {comparison ? (
            <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
              <div className="card px-2 py-2">
                <p className="text-zinc-500">harness-first</p>
                <p className="text-zinc-100">{comparison.harness.calls} calls · {comparison.harness.tokens} tok</p>
                <p className="text-zinc-500">avg {comparison.harness.avgTokensPerCall} tok/call</p>
              </div>
              <div className="card px-2 py-2">
                <p className="text-zinc-500">bypass</p>
                <p className="text-zinc-100">{comparison.bypass.calls} calls · {comparison.bypass.tokens} tok</p>
                <p className="text-zinc-500">avg {comparison.bypass.avgTokensPerCall} tok/call</p>
              </div>
              <div className="card px-2 py-2">
                <p className="text-zinc-500">ahorro por call</p>
                <p className="text-harness-soft">{Math.round(comparison.tokenSavingsRatio * 100)}%</p>
              </div>
            </div>
          ) : null}

          <div className="mb-3"><TelemetryCharts buckets={buckets} comparison={comparison} /></div>

          <table className="w-full text-left text-[11px]">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1">{groupBy}</th>
                <th className="py-1">tokens</th>
                <th className="py-1">usd</th>
                <th className="py-1">calls</th>
                <th className="py-1">dur</th>
                <th className="py-1 w-1/3"> </th>
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-zinc-500">sin datos de uso todavía</td>
                </tr>
              ) : null}
              {buckets.map((bucket) => (
                <tr key={bucket.key} className="border-t border-hairline text-zinc-300">
                  <td className="py-1 font-mono">{bucket.key}</td>
                  <td className="py-1">{bucket.tokens}</td>
                  <td className="py-1">${bucket.usd.toFixed(4)}</td>
                  <td className="py-1">{bucket.calls}</td>
                  <td className="py-1">{Math.round(bucket.durationMs / 1000)}s</td>
                  <td className="py-1">
                    <div className="h-2 rounded-full bg-harness/60" style={{ width: `${Math.round((bucket.tokens / maxTokens) * 100)}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {csv !== null ? (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">CSV exportado</p>
              <textarea readOnly aria-label="CSV de uso" value={csv} className="mt-1 h-28 w-full resize-y rounded-control border border-hairline bg-surface px-2 py-1 font-mono text-[10px] text-zinc-300 outline-none" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
