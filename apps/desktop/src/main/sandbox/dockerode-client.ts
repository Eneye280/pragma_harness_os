import Dockerode from "dockerode";
import type { SandboxContainerHandle, SandboxDockerClient, SandboxExecHandle } from "./docker-backend";

class DockerodeExecHandle implements SandboxExecHandle {
  constructor(private readonly innerExec: Dockerode.Exec) {}

  start() {
    return this.innerExec.start({});
  }

  async inspect(): Promise<{ ExitCode: number | null }> {
    const inspectResult = await this.innerExec.inspect();
    return { ExitCode: inspectResult.ExitCode ?? null };
  }
}

class DockerodeContainerHandle implements SandboxContainerHandle {
  constructor(
    readonly id: string,
    private readonly innerContainer: Dockerode.Container
  ) {}

  start(): Promise<void> {
    return this.innerContainer.start().then(() => undefined);
  }

  stop(): Promise<void> {
    return this.innerContainer.stop().then(() => undefined);
  }

  remove(): Promise<void> {
    return this.innerContainer.remove({ force: true }).then(() => undefined);
  }

  async exec(execOptions: { Cmd: string[]; AttachStdout: boolean; AttachStderr: boolean }): Promise<SandboxExecHandle> {
    const innerExec = await this.innerContainer.exec({ ...execOptions, AttachStdin: false, Tty: false });
    return new DockerodeExecHandle(innerExec);
  }
}

class DockerodeClientAdapter implements SandboxDockerClient {
  constructor(private readonly innerDocker: Dockerode) {}

  ping(): Promise<void> {
    return this.innerDocker.ping().then(() => undefined);
  }

  async createContainer(containerOptions: Record<string, unknown>): Promise<SandboxContainerHandle> {
    const created = await this.innerDocker.createContainer(containerOptions as Dockerode.ContainerCreateOptions);
    return new DockerodeContainerHandle(created.id, created);
  }

  demuxStream(
    stream: NodeJS.ReadableStream,
    stdout: { write(chunk: string): void },
    stderr: { write(chunk: string): void }
  ): void {
    this.innerDocker.modem.demuxStream(stream as never, stdout as never, stderr as never);
  }
}

export function createDockerodeClient(): SandboxDockerClient {
  const dockerode = new Dockerode();
  return new DockerodeClientAdapter(dockerode);
}
