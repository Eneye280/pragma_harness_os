import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CostTracker, dateKey } from "../cost-tracker";
import { approximateTokens, estimateCostUsd, priceFor } from "../pricing";

let dir = "";
let metricsPath = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "phs25-"));
  metricsPath = join(dir, "metrics.json");
});

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("pricing", () => {
  it("prices known models and falls back per provider", () => {
    expect(priceFor("deepseek", "deepseek-chat").inputPerMillion).toBe(0.27);
    expect(priceFor("anthropic", "claude-3-5-sonnet-20241022").outputPerMillion).toBe(15.0);
    expect(priceFor("ollama", "llama3.1").inputPerMillion).toBe(0);
    expect(priceFor("openai", "unknown-model").outputPerMillion).toBe(0.6);
  });

  it("estimates USD from input/output tokens", () => {
    expect(estimateCostUsd("deepseek", "deepseek-chat", 1_000_000, 0)).toBeCloseTo(0.27, 5);
    expect(estimateCostUsd("anthropic", "claude-3-5-sonnet", 0, 1_000_000)).toBeCloseTo(15, 5);
    expect(estimateCostUsd("ollama", "llama3.1", 50000, 50000)).toBe(0);
    expect(approximateTokens("12345678")).toBe(2);
  });
});

describe("CostTracker", () => {
  it("accumulates per-day, per-domain usage and persists metrics.json", () => {
    const tracker = new CostTracker(metricsPath);
    tracker.recordUsage({ domain: "backend", provider: "deepseek", model: "deepseek-chat", inputTokens: 1000, outputTokens: 500 });
    tracker.recordUsage({ domain: "engine", provider: "deepseek", model: "deepseek-chat", inputTokens: 2000, outputTokens: 1000 });
    tracker.recordUsage({ domain: "backend", provider: "deepseek", model: "deepseek-chat", inputTokens: 100, outputTokens: 100 });

    const snapshot = tracker.snapshot({ tokensPerDay: 200000, usdPerDay: 5 });
    expect(snapshot.today.calls).toBe(3);
    expect(snapshot.today.tokens).toBe(4700);
    expect(snapshot.today.inputTokens).toBe(3100);
    expect(snapshot.today.outputTokens).toBe(1600);
    expect(snapshot.total.calls).toBe(3);
    expect(snapshot.perDomain[0].domain).toBe("engine");
    expect(snapshot.perDomain.find((d) => d.domain === "backend")?.calls).toBe(2);
    expect(existsSync(metricsPath)).toBe(true);

    const reloaded = new CostTracker(metricsPath).snapshot();
    expect(reloaded.today.tokens).toBe(4700);
  });

  it("starts empty when metrics.json is missing and can reset", () => {
    const tracker = new CostTracker(metricsPath);
    expect(tracker.snapshot().today.tokens).toBe(0);
    tracker.recordUsage({ domain: "general", provider: "mock", model: "mock", inputTokens: 10, outputTokens: 10 });
    tracker.reset();
    expect(tracker.snapshot().today.tokens).toBe(0);
  });

  it("reports the budget it is given and today's date key", () => {
    const tracker = new CostTracker(metricsPath);
    expect(tracker.snapshot({ tokensPerDay: 1000, usdPerDay: 1 }).budget).toEqual({ tokensPerDay: 1000, usdPerDay: 1 });
    expect(dateKey(Date.UTC(2026, 8, 25, 12))).toBe("2026-09-25");
  });
});
