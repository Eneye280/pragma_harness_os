import { execFile } from "child_process";
import { resolve } from "path";

export interface TerminalRequest {
  command: string;
  args?: string[];
  workspacePath: string;
  timeoutMs?: number;
}

export interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_OUTPUT_CHARS = 20000;

const WINDOWS_SHIMS = new Set(["pnpm", "npm", "npx", "yarn", "tsc", "eslint", "vitest", "jest", "node-gyp"]);

export function resolveExecutable(command: string): string {
  if (process.platform !== "win32") return command;
  const base = command.toLowerCase();
  if (WINDOWS_SHIMS.has(base) && !command.toLowerCase().endsWith(".cmd")) return `${command}.cmd`;
  return command;
}

function truncateOutput(rawOutput: string): string {
  if (rawOutput.length <= MAX_OUTPUT_CHARS) return rawOutput;
  return `${rawOutput.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated ${rawOutput.length - MAX_OUTPUT_CHARS} chars]`;
}

function shellSplit(rawCommand: string): { executable: string; executableArgs: string[] } {
  const tokens = rawCommand.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error("terminal: empty command");
  const [executable, ...executableArgs] = tokens;
  return { executable, executableArgs };
}

export function runTerminal(request: TerminalRequest): Promise<TerminalResult> {
  const workspaceDir = resolve(request.workspacePath);
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const explicitArgs = request.args ?? [];
  const parsedCommand = explicitArgs.length > 0
    ? { executable: request.command, executableArgs: explicitArgs }
    : shellSplit(request.command);
  const displayCommand = explicitArgs.length > 0
    ? `${request.command} ${explicitArgs.join(" ")}`.trim()
    : request.command.trim();

  return new Promise((resolvePromise) => {
    const executable = resolveExecutable(parsedCommand.executable);
    const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(executable);
    execFile(
      executable,
      parsedCommand.executableArgs,
      { cwd: workspaceDir, timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024, shell: useShell },
      (executionError, stdout, stderr) => {
        const durationMs = Date.now() - startedAt;
        const timedOut = Boolean(executionError && "killed" in executionError && executionError.killed);
        const exitCode = typeof executionError?.code === "number" ? executionError.code : executionError ? 1 : 0;
        resolvePromise({
          stdout: truncateOutput(String(stdout ?? "")),
          stderr: truncateOutput(executionError?.message && !stdout && !stderr ? executionError.message : String(stderr ?? "")),
          exitCode,
          durationMs,
          timedOut,
          command: displayCommand,
        });
      }
    );
  });
}
