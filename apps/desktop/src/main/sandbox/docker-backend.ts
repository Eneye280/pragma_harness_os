import { resolve } from "path";
import type { Readable } from "stream";
import {
  DEFAULT_CONTAINER_WORKDIR,
  DEFAULT_SANDBOX_IMAGE,
  DEFAULT_SANDBOX_TIMEOUT_MS,
  type SandboxExecRequest,
  type SandboxExecResult,
} from "./types";

export interface SandboxExecHandle {
  start(): Promise<Readable>;
  inspect(): Promise<{ ExitCode: number | null }>;
}

export interface SandboxContainerHandle {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  remove(): Promise<void>;
  exec(execOptions: { Cmd: string[]; AttachStdout: boolean; AttachStderr: boolean }): Promise<SandboxExecHandle>;
}

export interface SandboxDockerClient {
  ping(): Promise<void>;
  createContainer(containerOptions: Record<string, unknown>): Promise<SandboxContainerHandle>;
  demuxStream(stream: Readable, stdout: { write(chunk: string): void }, stderr: { write(chunk: string): void }): void;
}

export interface DockerBackendOptions {
  image?: string;
  containerWorkdir?: string;
  network?: boolean;
  cpus?: number;
  memoryMb?: number;
  readOnlyWorkspace?: boolean;
  onLog?: (entry: { sessionId?: string; command: string; exitCode: number; durationMs: number; containerId: string }) => void;
}

const MAX_OUTPUT_CHARS = 20000;

function truncateSandboxOutput(rawOutput: string): string {
  if (rawOutput.length <= MAX_OUTPUT_CHARS) return rawOutput;
  return `${rawOutput.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated ${rawOutput.length - MAX_OUTPUT_CHARS} chars]`;
}

export class DockerBackend {
  constructor(
    private readonly dockerClient: SandboxDockerClient,
    private readonly backendOptions: DockerBackendOptions = {}
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      await this.dockerClient.ping();
      return true;
    } catch {
      return false;
    }
  }

  async execute(request: SandboxExecRequest): Promise<SandboxExecResult> {
    const startedAt = Date.now();
    const timeoutMs = request.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS;
    const image = this.backendOptions.image ?? DEFAULT_SANDBOX_IMAGE;
    const containerWorkdir = this.backendOptions.containerWorkdir ?? DEFAULT_CONTAINER_WORKDIR;
    const hostWorkspace = resolve(request.workspacePath);
    const execCommand = [request.command, ...(request.args ?? [])];
    const displayCommand = execCommand.join(" ");
    const bindMode = this.backendOptions.readOnlyWorkspace === false ? "" : ":ro";
    const hostConfig: Record<string, unknown> = {
      Binds: [`${hostWorkspace}:${containerWorkdir}${bindMode}`],
      AutoRemove: false,
      NetworkMode: this.backendOptions.network ? "bridge" : "none",
      SecurityOpt: ["no-new-privileges"],
    };
    if (this.backendOptions.cpus && this.backendOptions.cpus > 0) hostConfig.NanoCpus = Math.round(this.backendOptions.cpus * 1_000_000_000);
    if (this.backendOptions.memoryMb && this.backendOptions.memoryMb > 0) hostConfig.Memory = Math.round(this.backendOptions.memoryMb * 1024 * 1024);

    let container: SandboxContainerHandle | null = null;
    try {
      container = await this.dockerClient.createContainer({
        Image: image,
        Cmd: ["sleep", "infinity"],
        WorkingDir: containerWorkdir,
        Env: ["NODE_ENV=production"],
        HostConfig: hostConfig,
      });
      await container.start();

      const execHandle = await container.exec({ Cmd: execCommand, AttachStdout: true, AttachStderr: true });
      const execStream = await execHandle.start();

      let stdoutBuffer = "";
      let stderrBuffer = "";
      const streamDone = new Promise<void>((resolveStream) => {
        execStream.on("data", () => undefined);
        execStream.on("end", () => resolveStream());
        execStream.on("close", () => resolveStream());
      });
      this.dockerClient.demuxStream(
        execStream,
        { write: (chunk: string) => { stdoutBuffer += chunk; } },
        { write: (chunk: string) => { stderrBuffer += chunk; } }
      );

      const timeoutReached = await Promise.race([
        streamDone.then(() => false),
        new Promise<boolean>((resolveTimeout) => setTimeout(() => resolveTimeout(true), timeoutMs)),
      ]);

      if (timeoutReached) {
        await container.stop().catch(() => undefined);
        this.backendOptions.onLog?.({ sessionId: request.sessionId, command: displayCommand, exitCode: 124, durationMs: Date.now() - startedAt, containerId: container.id });
        return {
          stdout: truncateSandboxOutput(stdoutBuffer),
          stderr: truncateSandboxOutput(stderrBuffer || `sandbox: timeout after ${timeoutMs}ms`),
          exitCode: 124,
          durationMs: Date.now() - startedAt,
          timedOut: true,
          backend: "docker",
          command: displayCommand,
          containerId: container.id,
        };
      }

      const inspectResult = await execHandle.inspect();
      this.backendOptions.onLog?.({ sessionId: request.sessionId, command: displayCommand, exitCode: inspectResult.ExitCode ?? 1, durationMs: Date.now() - startedAt, containerId: container.id });
      return {
        stdout: truncateSandboxOutput(stdoutBuffer),
        stderr: truncateSandboxOutput(stderrBuffer),
        exitCode: inspectResult.ExitCode ?? 1,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        backend: "docker",
        command: displayCommand,
        containerId: container.id,
      };
    } finally {
      if (container) {
        await container.stop().catch(() => undefined);
        await container.remove().catch(() => undefined);
      }
    }
  }
}
