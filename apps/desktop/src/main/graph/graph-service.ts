import { readFileSync } from "fs";
import { join } from "path";
import fg from "fast-glob";
import { watch, type FSWatcher } from "chokidar";
import { buildDependencyGraph, type GraphFile } from "./builder";
import type { DependencyGraph, GraphDelta } from "../../shared/graph";

const PATTERNS = ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,cs}"];
const IGNORED = /(^|[\\/])(node_modules|dist|out|build|\.git|coverage|\.pragma-harness)([\\/]|$)/;
const MAX_FILE_CHARS = 200_000;

export class DependencyGraphService {
  private current: DependencyGraph = { nodes: [], edges: [], cycles: [], updatedAt: 0 };
  private watcher: FSWatcher | null = null;
  private workspacePath: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onUpdate: ((delta: GraphDelta) => void) | null = null;

  get graph(): DependencyGraph {
    return this.current;
  }

  async refresh(workspacePath: string | null): Promise<DependencyGraph> {
    if (!workspacePath) {
      this.current = { nodes: [], edges: [], cycles: [], updatedAt: Date.now() };
      return this.current;
    }
    const files = await this.collect(workspacePath);
    this.current = buildDependencyGraph(files);
    return this.current;
  }

  private async collect(workspacePath: string): Promise<GraphFile[]> {
    const paths = await fg(PATTERNS, { cwd: workspacePath, absolute: false, onlyFiles: true, ignore: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/coverage/**"] }).catch(() => []);
    const files: GraphFile[] = [];
    for (const relative of paths) {
      if (IGNORED.test(relative)) continue;
      try {
        const content = readFileSync(join(workspacePath, relative), "utf8").slice(0, MAX_FILE_CHARS);
        files.push({ path: relative, content });
      } catch {
        continue;
      }
    }
    return files;
  }

  watchWorkspace(workspacePath: string | null, onUpdate: (delta: GraphDelta) => void): void {
    this.onUpdate = onUpdate;
    this.stop();
    if (!workspacePath) return;
    this.workspacePath = workspacePath;
    this.watcher = watch(workspacePath, {
      ignored: (watchPath: string) => IGNORED.test(watchPath),
      ignoreInitial: true,
      persistent: true,
    });
    const schedule = (changedPath: string) => this.scheduleRefresh(changedPath);
    this.watcher.on("add", schedule).on("change", schedule).on("unlink", schedule);
  }

  private scheduleRefresh(changedPath: string): void {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|cs)$/i.test(changedPath)) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.emitDelta();
    }, 300);
  }

  private async emitDelta(): Promise<void> {
    if (!this.workspacePath || !this.onUpdate) return;
    const previousGraph = this.current;
    const previous = new Set(previousGraph.nodes.map((node) => node.id));
    const graph = await this.refresh(this.workspacePath);
    const next = new Set(graph.nodes.map((node) => node.id));
    const added = [...next].filter((id) => !previous.has(id));
    const removed = [...previous].filter((id) => !next.has(id));
    const changed = [...next].filter((id) => previous.has(id) && this.edgesFor(id, graph) !== this.edgesFor(id, previousGraph));
    this.onUpdate({ added, removed, changed, graph });
  }

  private edgesFor(id: string, graph: DependencyGraph): number {
    return graph.edges.filter((edge) => edge.from === id || edge.to === id).length;
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.watcher?.close();
    this.watcher = null;
  }
}
