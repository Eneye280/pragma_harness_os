export type SandboxBackend = "local" | "docker";

export interface SandboxSettings {
  enabled: boolean;
  image?: string;
  containerWorkdir?: string;
}

export interface TaskSandboxOverride {
  backend?: SandboxBackend;
}

export interface SandboxExecRequest {
  command: string;
  args?: string[];
  workspacePath: string;
  timeoutMs?: number;
}

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  backend: SandboxBackend;
  command: string;
  containerId?: string;
}

export const DEFAULT_SANDBOX_IMAGE = "node:22";
export const DEFAULT_CONTAINER_WORKDIR = "/work";
export const DEFAULT_SANDBOX_TIMEOUT_MS = 30000;

export function resolveSandboxBackend(
  settings: SandboxSettings | undefined,
  override?: TaskSandboxOverride
): SandboxBackend {
  if (override?.backend) return override.backend;
  if (settings?.enabled) return "docker";
  return "local";
}
