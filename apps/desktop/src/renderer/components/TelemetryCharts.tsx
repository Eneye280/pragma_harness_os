import type { UsageBucket } from "@shared/usage";
import { barRects, donutSegments, niceMax, sparklinePath } from "../telemetry/charts";

const PALETTE = ["#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#38bdf8"];

export function TelemetryCharts({ buckets, comparison }: { buckets: UsageBucket[]; comparison: { harness: { tokens: number }; bypass: { tokens: number } } | null }): React.ReactElement {
  const tokens = buckets.map((bucket) => bucket.tokens);
  const bars = barRects(tokens, 320, 60, 4);
  const max = niceMax(tokens);
  const donutValues = comparison ? [comparison.harness.tokens, comparison.bypass.tokens] : [1];
  const { circumference, segments } = donutSegments(donutValues, 26, 8);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="card p-3">
        <p className="text-[12px] tracking-label text-zinc-500">Tokens por periodo</p>
        <svg viewBox="0 0 320 60" className="mt-2 h-[60px] w-full" role="img" aria-label="Tokens por periodo">
          {bars.map((bar, index) => (
            <rect key={index} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={2} fill={PALETTE[0]} opacity={0.85} />
          ))}
        </svg>
        <p className="mt-1 text-[12px] text-zinc-500">máx {max} tok</p>
      </div>

      <div className="card p-3">
        <p className="text-[12px] tracking-label text-zinc-500">Tendencia</p>
        <svg viewBox="0 0 320 60" className="mt-2 h-[60px] w-full" role="img" aria-label="Tendencia de tokens">
          <path d={sparklinePath(tokens, 320, 60, 3)} fill="none" stroke={PALETTE[4]} strokeWidth={2} strokeLinecap="round" />
        </svg>
        <p className="mt-1 text-[12px] text-zinc-500">{buckets.length} periodos</p>
      </div>

      <div className="card flex items-center gap-3 p-3">
        <svg viewBox="0 0 72 72" className="h-[72px] w-[72px]" role="img" aria-label="Reparto harness vs bypass">
          <circle cx={36} cy={36} r={26} fill="none" stroke="#27272a" strokeWidth={8} />
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx={36}
              cy={36}
              r={26}
              fill="none"
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth={8}
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 36 36)"
            />
          ))}
        </svg>
        <div className="text-[12px]">
          <p className="tracking-label text-zinc-500">Harness vs bypass</p>
          <p className="mt-1 text-zinc-300">{comparison ? `${comparison.harness.tokens} tok` : "sin datos"}</p>
          <p className="text-zinc-500">{comparison ? `${comparison.bypass.tokens} tok bypass` : ""}</p>
        </div>
      </div>
    </div>
  );
}
