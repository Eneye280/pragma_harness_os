import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { DockerBackend, type SandboxContainerHandle, type SandboxDockerClient, type SandboxExecHandle } from "../docker-backend";
import { SandboxRunner } from "../runner";
import { resolveSandboxBackend } from "../types";

class FakeExecHandle implements SandboxExecHandle {
  constructor(
    private readonly exitCode: number,
    private readonly hangForever: boolean
  ) {}

  async start(): Promise<Readable> {
    if (this.hangForever) return new Readable({ read() {} });
    return Readable.from([]);
  }

  async inspect(): Promise<{ ExitCode: number | null }> {
    return { ExitCode: this.exitCode };
  }
}

class FakeContainerHandle implements SandboxContainerHandle {
  readonly id = `fake-${randomUUID().slice(0, 6)}`;
  startCalled = false;
  stopCalled = false;
  removeCalled = false;
  lastExecCmd: string[] = [];

  constructor(private readonly cannedExitCode: number, private readonly hangForever: boolean) {}

  async start(): Promise<void> {
    this.startCalled = true;
  }

  async stop(): Promise<void> {
    this.stopCalled = true;
  }

  async remove(): Promise<void> {
    this.removeCalled = true;
  }

  async exec(execOptions: { Cmd: string[]; AttachStdout: boolean; AttachStderr: boolean }): Promise<SandboxExecHandle> {
    this.lastExecCmd = execOptions.Cmd;
    return new FakeExecHandle(this.cannedExitCode, this.hangForever);
  }
}

class FakeDockerClient implements SandboxDockerClient {
  lastCreateOptions: Record<string, unknown> = {};
  lastContainer: FakeContainerHandle | null = null;

  constructor(
    private readonly cannedStdout: string = "",
    private readonly cannedExitCode: number = 0,
    private readonly hangForever: boolean = false,
    private readonly pingFails: boolean = false
  ) {}

  async ping(): Promise<void> {
    if (this.pingFails) throw new Error("daemon down");
  }

  async createContainer(containerOptions: Record<string, unknown>): Promise<SandboxContainerHandle> {
    this.lastCreateOptions = containerOptions;
    this.lastContainer = new FakeContainerHandle(this.cannedExitCode, this.hangForever);
    return this.lastContainer;
  }

  demuxStream(stream: Readable, stdout: { write(chunk: string): void }): void {
    if (this.cannedStdout) stdout.write(this.cannedStdout);
    void stream;
  }
}

describe("Sandbox Docker opt-in", () => {
  let workspacePath = "";

  beforeEach(() => {
    workspacePath = join(tmpdir(), `phs15-${randomUUID().slice(0, 8)}`);
    mkdirSync(workspacePath, { recursive: true });
  });

  afterEach(() => {
    if (workspacePath && existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });
  });

  it("resolves local by default, docker when enabled, override wins", () => {
    expect(resolveSandboxBackend(undefined)).toBe("local");
    expect(resolveSandboxBackend({ enabled: false })).toBe("local");
    expect(resolveSandboxBackend({ enabled: true })).toBe("docker");
    expect(resolveSandboxBackend({ enabled: true }, { backend: "local" })).toBe("local");
    expect(resolveSandboxBackend({ enabled: false }, { backend: "docker" })).toBe("docker");
  });

  it("runs the local backend inside the workspace dir", async () => {
    const runner = new SandboxRunner({ settings: { enabled: false } });
    const result = await runner.execute({ command: "node", args: ["-e", "process.stdout.write('local-ok')"], workspacePath });
    expect(result.backend).toBe("local");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("local-ok");
  });

  it("runs terminal commands inside an ephemeral container with the worktree mounted", async () => {
    const fakeClient = new FakeDockerClient("file-a\nfile-b\n", 0);
    const runner = new SandboxRunner({ settings: { enabled: true }, dockerClient: fakeClient });
    const result = await runner.execute({ command: "ls", args: [], workspacePath });
    expect(result.backend).toBe("docker");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("file-a");
    const createOptions = fakeClient.lastCreateOptions as { Image: string; WorkingDir: string; HostConfig: { Binds: string[] } };
    expect(createOptions.Image).toBe("node:22");
    expect(createOptions.WorkingDir).toBe("/work");
    expect(createOptions.HostConfig.Binds[0]).toContain(":/work");
    expect(createOptions.HostConfig.Binds[0]).toContain(workspacePath.slice(-12));
    expect(fakeClient.lastContainer?.lastExecCmd).toEqual(["ls"]);
    expect(fakeClient.lastContainer?.removeCalled).toBe(true);
  });

  it("mounts the worktree read-only by default, no network, with cpu/memory limits", async () => {
    const fakeClient = new FakeDockerClient("ok\n", 0);
    const runner = new SandboxRunner({
      settings: { enabled: true, cpus: 1.5, memoryMb: 512, network: false, readOnlyWorkspace: true },
      dockerClient: fakeClient,
    });
    await runner.execute({ command: "ls", args: [], workspacePath });
    const hostConfig = (fakeClient.lastCreateOptions as { HostConfig: { Binds: string[]; NetworkMode: string; NanoCpus?: number; Memory?: number; SecurityOpt?: string[] } }).HostConfig;
    expect(hostConfig.Binds[0].endsWith(":ro")).toBe(true);
    expect(hostConfig.NetworkMode).toBe("none");
    expect(hostConfig.NanoCpus).toBe(1_500_000_000);
    expect(hostConfig.Memory).toBe(512 * 1024 * 1024);
    expect(hostConfig.SecurityOpt).toContain("no-new-privileges");
  });

  it("allows a writable mount and network only when explicitly enabled", async () => {
    const fakeClient = new FakeDockerClient("ok\n", 0);
    const runner = new SandboxRunner({
      settings: { enabled: true, network: true, readOnlyWorkspace: false },
      dockerClient: fakeClient,
    });
    await runner.execute({ command: "ls", args: [], workspacePath });
    const hostConfig = (fakeClient.lastCreateOptions as { HostConfig: { Binds: string[]; NetworkMode: string } }).HostConfig;
    expect(hostConfig.Binds[0].endsWith(":ro")).toBe(false);
    expect(hostConfig.NetworkMode).toBe("bridge");
  });

  it("reports timeout and stops the container when the command hangs", async () => {
    const fakeClient = new FakeDockerClient("", 0, true);
    const backend = new DockerBackend(fakeClient);
    const result = await backend.execute({ command: "sleep", args: ["9999"], workspacePath, timeoutMs: 60 });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
    expect(result.backend).toBe("docker");
    expect(fakeClient.lastContainer?.stopCalled).toBe(true);
    expect(fakeClient.lastContainer?.removeCalled).toBe(true);
  });

  it("refuses docker execution when the daemon is unreachable, without silent local fallback", async () => {
    const fakeClient = new FakeDockerClient("", 0, false, true);
    const runner = new SandboxRunner({ settings: { enabled: true }, dockerClient: fakeClient });
    const result = await runner.execute({ command: "ls", args: [], workspacePath });
    expect(result.backend).toBe("docker");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/daemon unreachable/);
    expect(fakeClient.lastContainer).toBeNull();
  });

  it("honors the per-task override over global settings", async () => {
    const fakeClient = new FakeDockerClient("from-container\n", 0);
    const dockerByDefault = new SandboxRunner({ settings: { enabled: true }, dockerClient: fakeClient });
    const forcedLocal = await dockerByDefault.execute(
      { command: "node", args: ["-e", "process.stdout.write('forced-local')"], workspacePath },
      { backend: "local" }
    );
    expect(forcedLocal.backend).toBe("local");
    expect(forcedLocal.stdout).toBe("forced-local");

    const localByDefault = new SandboxRunner({ settings: { enabled: false }, dockerClient: fakeClient });
    const forcedDocker = await localByDefault.execute({ command: "ls", args: [], workspacePath }, { backend: "docker" });
    expect(forcedDocker.backend).toBe("docker");
    expect(forcedDocker.stdout).toContain("from-container");
  });

  it("runs a live container when a daemon is available (skipped otherwise)", async () => {
    const liveRunner = new SandboxRunner({ settings: { enabled: true } });
    if (!(await liveRunner.isDockerAvailable())) return;
    const result = await liveRunner.execute({ command: "ls", args: ["/work"], workspacePath, timeoutMs: 60000 });
    expect(result.backend).toBe("docker");
    expect(result.exitCode).toBe(0);
  });
});
