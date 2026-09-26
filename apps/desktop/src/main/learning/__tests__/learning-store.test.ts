import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { LearningStore } from "../learning-store";

describe("learning store", () => {
  let dir = "";
  let file = "";
  beforeEach(() => {
    dir = join(tmpdir(), `phs84-learn-${randomUUID().slice(0, 8)}`);
    file = join(dir, "learning.json");
  });
  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("records postmortems and proposes instincts after repeats", () => {
    const store = new LearningStore(file);
    store.record({ sessionId: "s1", goal: "a", outcome: "failed", failures: ["gate rojo"], fixes: ["correr tests"], lessons: [] });
    expect(store.snapshot().proposals).toHaveLength(0);
    store.record({ sessionId: "s2", goal: "b", outcome: "failed", failures: ["gate rojo"], fixes: ["correr tests"], lessons: [] });
    const snapshot = store.snapshot();
    expect(snapshot.summary.failed).toBe(2);
    expect(snapshot.proposals).toHaveLength(1);
    expect(snapshot.proposals[0].trigger).toBe("gate rojo");
  });

  it("survives a corrupt file", () => {
    const store = new LearningStore(file);
    expect(store.list()).toEqual([]);
  });
});
