import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { TerminalService } from "../terminal-service";

const FIXTURES: string[] = [];

function makeWorkspace(): string {
  const workspace = join(tmpdir(), `phs21-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspace, "src"), { recursive: true });
  writeFileSync(join(workspace, "README.md"), "# demo\n", "utf8");
  writeFileSync(join(workspace, "src", "index.ts"), "export const a = 1;\n", "utf8");
  FIXTURES.push(workspace);
  return workspace;
}

function collect(service: TerminalService, line: string): Promise<string> {
  let output = "";
  return service.run(line, (data) => {
    output += data;
  }).then(() => output);
}

afterEach(() => {
  while (FIXTURES.length > 0) {
    const workspace = FIXTURES.pop();
    if (workspace && existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  }
});

describe("TerminalService", () => {
  let workspace = "";
  let service: TerminalService;

  beforeEach(() => {
    workspace = makeWorkspace();
    service = new TerminalService({ workspacePath: workspace });
  });

  it("starts at the workspace with a relative prompt", () => {
    expect(service.workingDirectory).toBe(workspace);
    expect(service.prompt()).toBe(".$ ");
    expect(service.banner()).toContain("harness terminal");
  });

  it("lists workspace files with directories marked (ls gate)", async () => {
    const output = await collect(service, "ls");
    expect(output).toContain("README.md");
    expect(output).toContain("src/");
    expect(output).toContain("$ ");
  });

  it("changes directory and reflects it in the prompt", async () => {
    await collect(service, "cd src");
    expect(service.prompt()).toBe("src$ ");
    const listing = await collect(service, "ls");
    expect(listing).toContain("index.ts");
  });

  it("prints the absolute working directory with pwd", async () => {
    const output = await collect(service, "pwd");
    expect(output).toContain(workspace);
  });

  it("blocks cd outside the workspace", async () => {
    const output = await collect(service, "cd ../../");
    expect(output).toContain("fuera del workspace");
    expect(service.workingDirectory).toBe(workspace);
  });

  it("clears the screen with an escape sequence", async () => {
    const output = await collect(service, "clear");
    expect(output).toContain("\x1b[2J");
  });

  it("routes other commands through the shared command pool with the current cwd", async () => {
    const calls: Array<{ line: string; cwd: string }> = [];
    const injected = new TerminalService({
      workspacePath: workspace,
      runCommand: async (line, cwd) => {
        calls.push({ line, cwd });
        return { stdout: "hello harness\n", stderr: "", exitCode: 0 };
      },
    });
    const output = await collect(injected, "echo hello");
    expect(calls[0]).toEqual({ line: "echo hello", cwd: workspace });
    expect(output).toContain("hello harness");
    expect(output).toContain("$ ");
  });

  it("reports non-zero exit codes", async () => {
    const injected = new TerminalService({
      workspacePath: workspace,
      runCommand: async () => ({ stdout: "", stderr: "", exitCode: 3 }),
    });
    const output = await collect(injected, "fail-now");
    expect(output).toContain("[exit 3]");
  });

  it("keeps a command history", async () => {
    await collect(service, "ls");
    await collect(service, "pwd");
    expect(service.commandHistory).toEqual(["ls", "pwd"]);
  });
});
