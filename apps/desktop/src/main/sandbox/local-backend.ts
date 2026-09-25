import { runTerminal } from "../tools/terminal";
import type { SandboxExecRequest, SandboxExecResult } from "./types";

export function runLocalSandboxed(request: SandboxExecRequest): Promise<SandboxExecResult> {
  return runTerminal({
    command: request.command,
    args: request.args,
    workspacePath: request.workspacePath,
    timeoutMs: request.timeoutMs,
  }).then((terminalResult) => ({
    stdout: terminalResult.stdout,
    stderr: terminalResult.stderr,
    exitCode: terminalResult.exitCode,
    durationMs: terminalResult.durationMs,
    timedOut: terminalResult.timedOut,
    backend: "local" as const,
    command: terminalResult.command,
  }));
}
