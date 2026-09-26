import { describe, expect, it } from "vitest";
import { aggregateUsage, compareModes, filterByRange, toCsv, type UsageEntry } from "../usage";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 0, 10, 12);

function entry(overrides: Partial<UsageEntry>): UsageEntry {
  return {
    ts: now,
    sessionId: "s1",
    workspace: "/repo/a",
    mode: "harness",
    domain: "backend",
    tokens: 100,
    usd: 0.01,
    calls: 1,
    durationMs: 1000,
    ...overrides,
  };
}

describe("usage aggregation", () => {
  it("aggregates by day, session and project", () => {
    const entries = [
      entry({ ts: now, tokens: 100 }),
      entry({ ts: now, tokens: 200 }),
      entry({ ts: now - DAY, tokens: 50 }),
      entry({ sessionId: "s2", workspace: "/repo/b", tokens: 10 }),
    ];
    const byDay = aggregateUsage(entries, "day");
    expect(byDay[0].key).toBe("2026-01-10");
    expect(byDay[0].tokens).toBe(310);
    expect(byDay[0].calls).toBe(3);

    const bySession = aggregateUsage(entries, "session");
    expect(bySession.find((bucket) => bucket.key === "s2")?.tokens).toBe(10);
    const byProject = aggregateUsage(entries, "project");
    expect(byProject.find((bucket) => bucket.key === "/repo/b")?.calls).toBe(1);
  });

  it("filters by range", () => {
    const entries = [entry({ ts: now - 10 * DAY }), entry({ ts: now })];
    expect(filterByRange(entries, now - 7 * DAY)).toHaveLength(1);
    expect(filterByRange(entries)).toHaveLength(2);
  });

  it("compares harness-first vs bypass", () => {
    const comparison = compareModes([
      entry({ mode: "harness", tokens: 1000 }),
      entry({ mode: "harness", tokens: 1000 }),
      entry({ mode: "bypass", tokens: 4000 }),
      entry({ mode: "bypass", tokens: 4000 }),
    ]);
    expect(comparison.harness.avgTokensPerCall).toBe(1000);
    expect(comparison.bypass.avgTokensPerCall).toBe(4000);
    expect(comparison.tokenSavingsRatio).toBe(0.75);
  });

  it("exports buckets to CSV", () => {
    const csv = toCsv(aggregateUsage([entry({}), entry({})], "session"));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("key,tokens,usd,calls,durationMs,harnessCalls,bypassCalls");
    expect(lines[1]).toContain("s1,200");
  });
});
