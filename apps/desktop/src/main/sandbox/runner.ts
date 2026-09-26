import { DockerBackend, type SandboxDockerClient } from "./docker-backend";
import { createDockerodeClient } from "./dockerode-client";
import { runLocalSandboxed } from "./local-backend";
import {
  resolveSandboxBackend,
  type SandboxExecRequest,
  type SandboxExecResult,
  type SandboxSettings,
  type TaskSandboxOverride,
} from "./types";

export interface SandboxRunnerOptions {
  settings?: SandboxSettings;
  dockerClient?: SandboxDockerClient;
  createDefaultClient?: () => SandboxDockerClient;
  onLog?: (entry: { sessionId?: string; command: string; exitCode: number; durationMs: number; containerId: string }) => void;
}

export class SandboxRunner {
  constructor(private readonly runnerOptions: SandboxRunnerOptions = {}) {}

  resolveBackend(override?: TaskSandboxOverride) {
    return resolveSandboxBackend(this.runnerOptions.settings, override);
  }

  async isDockerAvailable(): Promise<boolean> {
    const dockerClient = this.runnerOptions.dockerClient ?? this.safeDefaultClient();
    if (!dockerClient) return false;
    return new DockerBackend(dockerClient).isAvailable();
  }

  private safeDefaultClient(): SandboxDockerClient | null {
    if (this.runnerOptions.dockerClient) return this.runnerOptions.dockerClient;
    if (this.runnerOptions.createDefaultClient) return this.runnerOptions.createDefaultClient();
    try {
      return createDockerodeClient();
    } catch {
      return null;
    }
  }

  async execute(request: SandboxExecRequest, override?: TaskSandboxOverride): Promise<SandboxExecResult> {
    const backend = this.resolveBackend(override);
    if (backend === "local") return runLocalSandboxed(request);

    const dockerClient = this.safeDefaultClient();
    if (!dockerClient) {
      return {
        stdout: "",
        stderr: "sandbox: docker requested but no docker client is configured",
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        backend: "docker",
        command: [request.command, ...(request.args ?? [])].join(" "),
      };
    }
    const dockerBackend = new DockerBackend(dockerClient, {
      image: this.runnerOptions.settings?.image,
      containerWorkdir: this.runnerOptions.settings?.containerWorkdir,
      network: this.runnerOptions.settings?.network,
      cpus: this.runnerOptions.settings?.cpus,
      memoryMb: this.runnerOptions.settings?.memoryMb,
      readOnlyWorkspace: this.runnerOptions.settings?.readOnlyWorkspace,
      onLog: this.runnerOptions.onLog,
    });
    const dockerAvailable = await dockerBackend.isAvailable();
    if (!dockerAvailable) {
      return {
        stdout: "",
        stderr: "sandbox: docker daemon unreachable — refusing to run outside the sandbox (no silent local fallback)",
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        backend: "docker",
        command: [request.command, ...(request.args ?? [])].join(" "),
      };
    }
    return dockerBackend.execute(request);
  }
}
