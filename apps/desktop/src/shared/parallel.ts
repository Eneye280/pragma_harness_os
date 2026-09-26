export interface ParallelTask {
  id: string;
  sessionId: string;
  message: string;
  workspacePath: string;
}

export type ParallelStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface ParallelRun {
  id: string;
  sessionId: string;
  status: ParallelStatus;
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

export function scheduleWaves(taskCount: number, maxConcurrency: number): number[][] {
  const limit = Math.max(1, Math.floor(maxConcurrency));
  const waves: number[][] = [];
  let index = 0;
  while (index < taskCount) {
    waves.push(Array.from({ length: Math.min(limit, taskCount - index) }, (_, offset) => index + offset));
    index += limit;
  }
  return waves;
}

export function parallelSummary(runs: ParallelRun[]): Record<ParallelStatus, number> {
  return {
    queued: runs.filter((run) => run.status === "queued").length,
    running: runs.filter((run) => run.status === "running").length,
    done: runs.filter((run) => run.status === "done").length,
    failed: runs.filter((run) => run.status === "failed").length,
    cancelled: runs.filter((run) => run.status === "cancelled").length,
  };
}

export interface ParallelExecutorDeps {
  run: (task: ParallelTask) => Promise<void>;
  maxConcurrency?: number;
  onUpdate?: (runs: ParallelRun[]) => void;
}

export async function executeParallel(tasks: ParallelTask[], deps: ParallelExecutorDeps): Promise<ParallelRun[]> {
  const maxConcurrency = Math.max(1, deps.maxConcurrency ?? 2);
  const runs: ParallelRun[] = tasks.map((task) => ({ id: task.id, sessionId: task.sessionId, status: "queued" }));
  const byId = new Map(runs.map((run) => [run.id, run]));
  const touch = (): void => deps.onUpdate?.([...runs]);

  const worker = async (task: ParallelTask): Promise<void> => {
    const run = byId.get(task.id);
    if (!run) return;
    run.status = "running";
    run.startedAt = Date.now();
    touch();
    try {
      await deps.run(task);
      run.status = "done";
    } catch (error) {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : "run failed";
    } finally {
      run.endedAt = Date.now();
      touch();
    }
  };

  let cursor = 0;
  const workers = Array.from({ length: Math.min(maxConcurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      await worker(task);
    }
  });
  touch();
  await Promise.all(workers);
  return runs;
}
