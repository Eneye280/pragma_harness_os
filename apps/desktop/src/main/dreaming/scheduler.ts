import { consolidate, type ConsolidationResult, type DreamEvent, type DreamingDeps } from "./dreaming";

export interface DreamingSchedulerOptions {
  getEvents: () => DreamEvent[];
  workspacePath: () => string;
  deps: DreamingDeps;
  onLearned?: (results: ConsolidationResult[]) => void;
  intervalMs?: number;
  debounceMs?: number;
}

export class DreamingScheduler {
  private intervalTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: DreamingSchedulerOptions) {}

  start(): void {
    if (this.intervalTimer) return;
    const intervalMs = this.options.intervalMs ?? 300000;
    this.intervalTimer = setInterval(() => {
      void this.run();
    }, intervalMs);
  }

  schedule(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.run();
    }, this.options.debounceMs ?? 1500);
  }

  async run(): Promise<ConsolidationResult[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const results = await consolidate(this.options.getEvents(), this.options.workspacePath(), this.options.deps);
      if (results.length > 0) this.options.onLearned?.(results);
      return results;
    } catch {
      return [];
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.intervalTimer = null;
    this.debounceTimer = null;
  }
}
