import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { UsageStore } from "../usage-store";

describe("usage store", () => {
  let file = "";
  beforeEach(() => {
    file = join(tmpdir(), `phs84-usage-${randomUUID().slice(0, 8)}.jsonl`);
  });
  afterEach(() => {
    if (existsSync(file)) rmSync(file, { force: true });
  });

  it("appends and reads entries", () => {
    const store = new UsageStore(file);
    store.record({ ts: 1, sessionId: "s1", workspace: "/w", mode: "harness", domain: "backend", tokens: 10, usd: 0.001, calls: 1, durationMs: 5 });
    store.record({ ts: 2, sessionId: "s1", workspace: "/w", mode: "bypass", domain: "backend", tokens: 20, usd: 0.002, calls: 1, durationMs: 6 });
    expect(store.all()).toHaveLength(2);
    expect(store.all()[1].tokens).toBe(20);
  });

  it("returns empty when the file does not exist and never throws", () => {
    const store = new UsageStore(join(tmpdir(), `missing-${randomUUID()}.jsonl`));
    expect(store.all()).toEqual([]);
  });
});
