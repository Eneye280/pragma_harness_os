import { describe, expect, it } from "vitest";
import { executeParallel, parallelSummary, scheduleWaves, type ParallelTask } from "../parallel";

const task = (index: number): ParallelTask => ({ id: `t${index}`, sessionId: `s${index}`, message: `m${index}`, workspacePath: "/w" });

describe("parallel agent scheduler", () => {
  it("schedules waves capped by max concurrency", () => {
    expect(scheduleWaves(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(scheduleWaves(3, 0)).toEqual([[0], [1], [2]]);
    expect(scheduleWaves(0, 3)).toEqual([]);
  });

  it("runs tasks with a concurrency limit", async () => {
    let running = 0;
    let maxRunning = 0;
    const runs = await executeParallel([task(0), task(1), task(2), task(3)], {
      maxConcurrency: 2,
      run: async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
    });
    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(parallelSummary(runs).done).toBe(4);
  });

  it("isolates failures per run", async () => {
    const runs = await executeParallel([task(0), task(1)], {
      maxConcurrency: 2,
      run: async (current) => {
        if (current.id === "t1") throw new Error("boom");
      },
    });
    const summary = parallelSummary(runs);
    expect(summary.done).toBe(1);
    expect(summary.failed).toBe(1);
    expect(runs.find((run) => run.id === "t1")?.error).toBe("boom");
  });
});
