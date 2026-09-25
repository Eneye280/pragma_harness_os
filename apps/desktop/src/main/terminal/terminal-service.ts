import { execFile } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import { relative, resolve, sep } from "path";

export interface TerminalCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TerminalServiceOptions {
  workspacePath: string;
  timeoutMs?: number;
  runCommand?: (line: string, cwd: string, timeoutMs: number) => Promise<TerminalCommandResult>;
}

const PROMPT_SUFFIX = "$ ";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_OUTPUT_CHARS = 20000;

function isInsideWorkspace(workspacePath: string, candidate: string): boolean {
  const workspace = resolve(workspacePath) + sep;
  const target = resolve(candidate);
  return target === resolve(workspacePath) || target.startsWith(workspace);
}

function truncate(rawOutput: string): string {
  if (rawOutput.length <= MAX_OUTPUT_CHARS) return rawOutput;
  return `${rawOutput.slice(0, MAX_OUTPUT_CHARS)}\n…[truncado ${rawOutput.length - MAX_OUTPUT_CHARS} chars]`;
}

export function defaultRunCommand(line: string, cwd: string, timeoutMs: number): Promise<TerminalCommandResult> {
  const isWindows = process.platform === "win32";
  const shellExecutable = isWindows ? process.env["ComSpec"] ?? "cmd.exe" : process.env["SHELL"] ?? "/bin/sh";
  const shellFlag = isWindows ? "/c" : "-c";
  return new Promise((resolvePromise) => {
    execFile(
      shellExecutable,
      [shellFlag, line],
      { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (executionError, stdout, stderr) => {
        const exitCode = typeof executionError?.code === "number" ? executionError.code : executionError ? 1 : 0;
        resolvePromise({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? "") || (executionError && !stdout ? executionError.message : ""),
          exitCode,
        });
      }
    );
  });
}

export class TerminalService {
  private cwd: string;
  private readonly history: string[] = [];

  constructor(private readonly options: TerminalServiceOptions) {
    this.cwd = resolve(options.workspacePath);
  }

  get workingDirectory(): string {
    return this.cwd;
  }

  get commandHistory(): string[] {
    return [...this.history];
  }

  prompt(): string {
    const relativePath = relative(resolve(this.options.workspacePath), this.cwd).replace(/\\/g, "/");
    return `${relativePath || "."}${PROMPT_SUFFIX}`;
  }

  banner(): string {
    return `harness terminal · ${this.cwd}\r\n${this.prompt()}`;
  }

  private listDirectory(targetPath: string): string {
    const entries = readdirSync(targetPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort((left, right) => {
        const leftDir = left.endsWith("/");
        const rightDir = right.endsWith("/");
        if (leftDir !== rightDir) return leftDir ? -1 : 1;
        return left.localeCompare(right);
      });
    return entries.length === 0 ? "(vacío)\r\n" : `${entries.join("   ")}\r\n`;
  }

  async run(rawLine: string, emit: (data: string) => void): Promise<void> {
    const line = rawLine.trim();
    if (!line) {
      emit(this.prompt());
      return;
    }
    this.history.push(line);

    const [command, ...commandArgs] = line.split(/\s+/);
    const argument = commandArgs[0];

    if (command === "clear" || command === "cls") {
      emit("\x1b[2J\x1b[3J\x1b[H");
      emit(this.prompt());
      return;
    }

    if (command === "pwd") {
      emit(`${this.cwd}\r\n${this.prompt()}`);
      return;
    }

    if (command === "cd") {
      const targetCandidate = argument ? resolve(this.cwd, argument) : resolve(this.options.workspacePath);
      if (!isInsideWorkspace(this.options.workspacePath, targetCandidate)) {
        emit(`\x1b[31mcd: fuera del workspace\x1b[0m\r\n${this.prompt()}`);
        return;
      }
      if (!existsSync(targetCandidate) || !statSync(targetCandidate).isDirectory()) {
        emit(`\x1b[31mcd: no existe el directorio ${argument ?? ""}\x1b[0m\r\n${this.prompt()}`);
        return;
      }
      this.cwd = targetCandidate;
      emit(this.prompt());
      return;
    }

    if (command === "ls" || command === "ll" || command === "dir") {
      const targetCandidate = argument ? resolve(this.cwd, argument) : this.cwd;
      if (!isInsideWorkspace(this.options.workspacePath, targetCandidate) || !existsSync(targetCandidate)) {
        emit(`\x1b[31mls: ruta inválida\x1b[0m\r\n${this.prompt()}`);
        return;
      }
      emit(this.listDirectory(targetCandidate));
      emit(this.prompt());
      return;
    }

    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const runCommand = this.options.runCommand ?? defaultRunCommand;
    const result = await runCommand(line, this.cwd, timeoutMs);
    if (result.stdout) emit(truncate(result.stdout).replace(/\n/g, "\r\n"));
    if (result.stderr) emit(`\x1b[31m${truncate(result.stderr).replace(/\n/g, "\r\n")}\x1b[0m`);
    if (result.exitCode !== 0 && !result.stderr) emit(`\x1b[31m[exit ${result.exitCode}]\x1b[0m\r\n`);
    emit(this.prompt());
  }
}
