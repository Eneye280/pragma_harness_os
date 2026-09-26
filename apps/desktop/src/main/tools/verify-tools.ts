import { resolvePostGateCommand } from "../postgates/phases";
import { shellTokens } from "../postgates/command-runner";
import { runTerminal } from "./terminal";
import { redactSecrets } from "./types";

export type VerifyToolName = "runBuild" | "runTests" | "runLint";

export interface VerifyResult {
  ok: boolean;
  command: string;
  output: string;
  exitCode: number;
  durationMs: number;
}

const PHASE_FOR_TOOL: Record<VerifyToolName, "build" | "tests" | "lint"> = {
  runBuild: "build",
  runTests: "tests",
  runLint: "lint",
};

const MAX_OUTPUT_CHARS = 8000;
const DEFAULT_TIMEOUT_MS = 120000;

export interface VerifyExecutor {
  (command: string, args: string[], workspacePath: string, timeoutMs: number): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number; timedOut?: boolean }>;
}

const defaultExecutor: VerifyExecutor = async (command, args, workspacePath, timeoutMs) => {
  const result = await runTerminal({ command, args, workspacePath, timeoutMs });
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, durationMs: result.durationMs, timedOut: result.timedOut };
};

export async function runVerifyTool(
  tool: VerifyToolName,
  workspacePath: string,
  options: { timeoutMs?: number; domain?: string; exec?: VerifyExecutor } = {}
): Promise<VerifyResult> {
  const phase = PHASE_FOR_TOOL[tool];
  const rawCommand = resolvePostGateCommand(phase, options.domain ?? "general");
  if (!rawCommand) {
    return { ok: false, command: "", output: `no command configured for ${phase}`, exitCode: -1, durationMs: 0 };
  }
  const { command, args } = shellTokens(rawCommand);
  const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 180000);
  const exec = options.exec ?? defaultExecutor;
  try {
    const result = await exec(command, args, workspacePath, timeoutMs);
    const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const output = redactSecrets(combined).slice(0, MAX_OUTPUT_CHARS);
    const suffix = result.timedOut ? " (timed out)" : "";
    return {
      ok: result.exitCode === 0 && !result.timedOut,
      command: rawCommand,
      output: output || `${rawCommand} exited ${result.exitCode}${suffix}`,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    };
  } catch (error) {
    return {
      ok: false,
      command: rawCommand,
      output: error instanceof Error ? error.message : "verification tool failed",
      exitCode: -1,
      durationMs: 0,
    };
  }
}
