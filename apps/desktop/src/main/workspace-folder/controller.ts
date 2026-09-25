import { existsSync, statSync } from "fs";
import { resolve } from "path";
import type { WorkspaceState } from "../../shared/workspace";
import type { SettingsStore } from "../settings";
import { resolveHarnessWorkspace } from "../workspace-path";

const MAX_RECENTS = 10;

export function isDirectory(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

export interface WorkspaceFolderDeps {
  store: SettingsStore;
  fallback?: () => string;
  maxRecents?: number;
}

export class WorkspaceFolderController {
  private readonly listeners = new Set<(path: string) => void>();

  constructor(private readonly deps: WorkspaceFolderDeps) {}

  private get fallback(): string {
    return (this.deps.fallback ?? resolveHarnessWorkspace)();
  }

  private get maxRecents(): number {
    return this.deps.maxRecents ?? MAX_RECENTS;
  }

  state(): WorkspaceState {
    const workspace = this.deps.store.getGlobal().workspace;
    const active = workspace.active && isDirectory(workspace.active) ? workspace.active : this.fallback;
    return { active, recents: workspace.recents.filter(isDirectory) };
  }

  current(): string {
    const configured = this.deps.store.getGlobal().workspace.active;
    if (configured && isDirectory(configured)) return configured;
    return this.fallback;
  }

  recents(): string[] {
    return this.state().recents;
  }

  activate(rawPath: string): WorkspaceState {
    const candidate = resolve(rawPath);
    if (!isDirectory(candidate)) throw new Error(`no es un directorio válido: ${candidate}`);
    const previous = this.deps.store.getGlobal().workspace;
    const recents = [candidate, ...previous.recents.filter((entry) => entry !== candidate)].slice(0, this.maxRecents);
    const next: WorkspaceState = { active: candidate, recents };
    this.deps.store.updateWorkspace(next);
    for (const listener of this.listeners) listener(candidate);
    return next;
  }

  onChange(listener: (path: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
