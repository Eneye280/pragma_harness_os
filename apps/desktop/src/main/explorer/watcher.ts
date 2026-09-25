import { watch, type FSWatcher } from "chokidar";

const IGNORED_SEGMENTS = /(^|[\\/])(node_modules|\.git|dist|out|build|coverage|\.harness|\.next)([\\/]|$)/;

export interface WatcherOptions {
  debounceMs?: number;
  onChange: (paths: string[]) => void;
}

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null;
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly workspacePath: string,
    private readonly options: WatcherOptions
  ) {}

  start(): void {
    if (this.watcher) return;
    this.watcher = watch(this.workspacePath, {
      ignoreInitial: true,
      persistent: true,
      ignored: (watchPath: string) => IGNORED_SEGMENTS.test(watchPath),
    });
    const handle = (watchPath: string) => this.enqueue(watchPath);
    this.watcher.on("add", handle).on("change", handle).on("unlink", handle).on("addDir", handle).on("unlinkDir", handle);
  }

  private enqueue(watchPath: string): void {
    this.pending.add(watchPath);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const paths = [...this.pending];
      this.pending.clear();
      this.timer = null;
      this.options.onChange(paths);
    }, this.options.debounceMs ?? 250);
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.watcher?.close();
    this.watcher = null;
  }
}
