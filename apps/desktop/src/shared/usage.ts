export type UsageMode = "harness" | "bypass";

export interface UsageEntry {
  ts: number;
  sessionId: string;
  workspace: string;
  mode: UsageMode;
  domain: string;
  tokens: number;
  usd: number;
  calls: number;
  durationMs: number;
}

export type UsageGroupBy = "day" | "session" | "project";

export interface UsageBucket {
  key: string;
  tokens: number;
  usd: number;
  calls: number;
  durationMs: number;
  harnessCalls: number;
  bypassCalls: number;
}

export interface UsageComparison {
  harness: { calls: number; tokens: number; usd: number; avgTokensPerCall: number };
  bypass: { calls: number; tokens: number; usd: number; avgTokensPerCall: number };
  tokenSavingsRatio: number;
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function filterByRange(entries: UsageEntry[], fromTs?: number, toTs?: number): UsageEntry[] {
  return entries.filter((entry) => (fromTs === undefined || entry.ts >= fromTs) && (toTs === undefined || entry.ts <= toTs));
}

function bucketKey(entry: UsageEntry, groupBy: UsageGroupBy): string {
  if (groupBy === "session") return entry.sessionId || "sin-sesión";
  if (groupBy === "project") return entry.workspace || "sin-proyecto";
  return dayKey(entry.ts);
}

export function aggregateUsage(entries: UsageEntry[], groupBy: UsageGroupBy = "day"): UsageBucket[] {
  const buckets = new Map<string, UsageBucket>();
  for (const entry of entries) {
    const key = bucketKey(entry, groupBy);
    const bucket = buckets.get(key) ?? { key, tokens: 0, usd: 0, calls: 0, durationMs: 0, harnessCalls: 0, bypassCalls: 0 };
    bucket.tokens += entry.tokens;
    bucket.usd = Number((bucket.usd + entry.usd).toFixed(6));
    bucket.calls += entry.calls;
    bucket.durationMs += entry.durationMs;
    if (entry.mode === "bypass") bucket.bypassCalls += entry.calls;
    else bucket.harnessCalls += entry.calls;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((left, right) => right.key.localeCompare(left.key));
}

export function compareModes(entries: UsageEntry[]): UsageComparison {
  const summarize = (mode: UsageMode): { calls: number; tokens: number; usd: number; avgTokensPerCall: number } => {
    const matching = entries.filter((entry) => entry.mode === mode);
    const tokens = matching.reduce((sum, entry) => sum + entry.tokens, 0);
    const usd = Number(matching.reduce((sum, entry) => sum + entry.usd, 0).toFixed(6));
    const calls = matching.reduce((sum, entry) => sum + entry.calls, 0);
    return { calls, tokens, usd, avgTokensPerCall: calls === 0 ? 0 : Math.round(tokens / calls) };
  };
  const harness = summarize("harness");
  const bypass = summarize("bypass");
  const tokenSavingsRatio = bypass.avgTokensPerCall === 0 ? 0 : Number((1 - harness.avgTokensPerCall / bypass.avgTokensPerCall).toFixed(3));
  return { harness, bypass, tokenSavingsRatio };
}

export function toCsv(buckets: UsageBucket[]): string {
  const header = "key,tokens,usd,calls,durationMs,harnessCalls,bypassCalls";
  const rows = buckets.map((bucket) =>
    [bucket.key, bucket.tokens, bucket.usd, bucket.calls, bucket.durationMs, bucket.harnessCalls, bucket.bypassCalls].join(",")
  );
  return [header, ...rows].join("\n");
}
