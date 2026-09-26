import { watch, type FSWatcher } from "chokidar";

export type HotReloadKind = "skills" | "plugins" | "agents" | "profile";

export interface HotReloadChange {
  kinds: HotReloadKind[];
  paths: string[];
  ts: number;
}

export interface HotReloadTarget {
  kind: HotReloadKind;
  path: string;
  invalidate: () => void;
}

export interface WatchHandle {
  close: () => void;
}

export interface HotReloadOptions {
  targets: HotReloadTarget[];
  onChange: (change: HotReloadChange) => void;
  debounceMs?: number;
  watchFactory?: (path: string, onChange: (changedPath: string) => void) => WatchHandle;
}

function defaultWatchFactory(path: string, onChange: (changedPath: string) => void): WatchHandle {
  const watcher: FSWatcher = watch(path, { ignoreInitial: true, persistent: true, depth: 6 });
  watcher.on("add", onChange).on("change", onChange).on("unlink", onChange).on("addDir", onChange).on("unlinkDir", onChange);
  return { close: () => void watcher.close() };
}

const DEFAULT_DEBOUNCE_MS = 250;

export class HotReloadRegistry {
  private handles: WatchHandle[] = [];
  private readonly pending = new Map<HotReloadKind, Set<string>>();
  private readonly invalidated = new Set<HotReloadKind>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: HotReloadOptions) {}

  start(): void {
    this.stop();
    const factory = this.options.watchFactory ?? defaultWatchFactory;
    for (const target of this.options.targets) {
      this.handles.push(
        factory(target.path, (changedPath) => this.enqueue(target.kind, changedPath))
      );
    }
  }

  private enqueue(kind: HotReloadKind, changedPath: string): void {
    const paths = this.pending.get(kind) ?? new Set<string>();
    paths.add(changedPath);
    this.pending.set(kind, paths);
    this.invalidated.add(kind);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private flush(): void {
    this.timer = null;
    const kinds = [...this.invalidated];
    const paths = [...new Set([...this.pending.values()].flatMap((set) => [...set]))];
    this.invalidated.clear();
    this.pending.clear();
    if (kinds.length === 0) return;
    for (const target of this.options.targets) {
      if (kinds.includes(target.kind)) target.invalidate();
    }
    this.options.onChange({ kinds, paths, ts: Date.now() });
  }

  refresh(): void {
    for (const target of this.options.targets) this.invalidated.add(target.kind);
    this.flush();
  }

  stop(): void {    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const handle of this.handles) handle.close();
    this.handles = [];
    this.pending.clear();
    this.invalidated.clear();
  }
}
