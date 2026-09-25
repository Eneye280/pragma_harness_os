import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { resolveSettingsPath } from "../settings/settings-store";
import { estimateCostUsd } from "./pricing";
import type { CostSnapshot, CostTotals, DomainMetrics, UsageRecord } from "../../shared/cost";

interface MetricsFile {
  updatedAt: number;
  days: Record<string, CostTotals & { domains: Record<string, DomainMetrics> }>;
}

const EMPTY_TOTALS: CostTotals = { tokens: 0, usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 };

export function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function resolveMetricsPath(): string {
  const configured = process.env["HARNESS_METRICS_PATH"];
  if (configured) return configured;
  return join(dirname(resolveSettingsPath()), "metrics.json");
}

export class CostTracker {
  constructor(private readonly filePath: string = resolveMetricsPath()) {}

  private load(): MetricsFile {
    if (!existsSync(this.filePath)) return { updatedAt: 0, days: {} };
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as MetricsFile;
      if (!parsed.days) return { updatedAt: 0, days: {} };
      return parsed;
    } catch {
      return { updatedAt: 0, days: {} };
    }
  }

  private persist(metrics: MetricsFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(metrics, null, 2), "utf8");
  }

  recordUsage(record: UsageRecord): CostSnapshot {
    const ts = record.ts ?? Date.now();
    const key = dateKey(ts);
    const metrics = this.load();
    const day = metrics.days[key] ?? { ...EMPTY_TOTALS, domains: {} };

    const usd = estimateCostUsd(record.provider, record.model, record.inputTokens, record.outputTokens);
    const tokens = record.inputTokens + record.outputTokens;

    day.inputTokens += record.inputTokens;
    day.outputTokens += record.outputTokens;
    day.tokens += tokens;
    day.usd = Number((day.usd + usd).toFixed(6));
    day.calls += 1;

    const domain = day.domains[record.domain] ?? { domain: record.domain, tokens: 0, usd: 0, calls: 0 };
    domain.tokens += tokens;
    domain.usd = Number((domain.usd + usd).toFixed(6));
    domain.calls += 1;
    day.domains[record.domain] = domain;

    metrics.days[key] = day;
    metrics.updatedAt = ts;
    this.persist(metrics);

    return this.snapshot(undefined, ts);
  }

  snapshot(budget?: { tokensPerDay: number; usdPerDay: number }, ts = Date.now()): CostSnapshot {
    const metrics = this.load();
    const today = metrics.days[dateKey(ts)] ?? { ...EMPTY_TOTALS, domains: {} };
    const totals = Object.values(metrics.days).reduce(
      (accumulator, day) => ({
        tokens: accumulator.tokens + day.tokens,
        usd: accumulator.usd + day.usd,
        calls: accumulator.calls + day.calls,
      }),
      { tokens: 0, usd: 0, calls: 0 }
    );
    const perDomain = Object.values(today.domains)
      .map((domain) => ({ ...domain, usd: Number(domain.usd.toFixed(6)) }))
      .sort((left, right) => right.tokens - left.tokens);

    return {
      today: {
        tokens: today.tokens,
        usd: Number(today.usd.toFixed(6)),
        calls: today.calls,
        inputTokens: today.inputTokens,
        outputTokens: today.outputTokens,
      },
      total: { tokens: totals.tokens, usd: Number(totals.usd.toFixed(6)), calls: totals.calls },
      budget: budget ?? { tokensPerDay: 200000, usdPerDay: 5 },
      perDomain,
      updatedAt: metrics.updatedAt,
    };
  }

  reset(): void {
    this.persist({ updatedAt: Date.now(), days: {} });
  }

  get file(): string {
    return this.filePath;
  }
}
