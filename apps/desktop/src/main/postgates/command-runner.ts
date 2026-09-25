import { runTerminal } from "../tools/terminal";
import type { CommandResult, CommandRunner } from "./types";

export function shellTokens(rawCommand: string): { command: string; args: string[] } {
  const tokens = rawCommand.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error("command runner: empty command");
  const [command, ...args] = tokens;
  return { command, args };
}

export class TerminalCommandRunner implements CommandRunner {
  async run(command: string, args: string[], workspacePath: string): Promise<CommandResult> {
    const terminalResult = await runTerminal({ command, args, workspacePath });
    return { exitCode: terminalResult.exitCode, stdout: terminalResult.stdout, stderr: terminalResult.stderr };
  }
}

export const terminalCommandRunner = new TerminalCommandRunner();
