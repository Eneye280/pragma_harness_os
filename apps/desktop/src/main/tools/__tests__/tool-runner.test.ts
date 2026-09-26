import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { ToolRunner } from "../runner";
import { healthCheckMcp, loadMcpConfig, redactMcpEnv, routeMcpTool } from "../mcp";
import { redactSecrets } from "../types";
import type { ToolCallInput } from "../types";

function makeWorkspace(): string {
  const workspacePath = join(tmpdir(), `phs13-${randomUUID().slice(0, 8)}`);
  mkdirSync(workspacePath, { recursive: true });
  return workspacePath;
}

function makeInput(overrides: Partial<ToolCallInput> & { tool: ToolCallInput["tool"]; workspacePath: string }): ToolCallInput {
  return {
    args: {},
    sessionId: `sess-${randomUUID().slice(0, 6)}`,
    workspaceHash: "hash13",
    ...overrides,
  };
}

describe("ToolRunner — file terminal and mcp support", () => {
  let workspacePath = "";
  let eventTypes: string[] = [];

  beforeEach(() => {
    workspacePath = makeWorkspace();
    eventTypes = [];
  });

  afterEach(() => {
    if (workspacePath && existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });
  });

  it("writes a new file and exposes a diff preview", async () => {
    const runner = new ToolRunner({
      permission: "allow",
      eventSink: (eventType) => eventTypes.push(eventType),
    });
    const observation = await runner.execute(
      makeInput({ tool: "fileEdit", workspacePath, args: { path: "notes/hello.txt", content: "hola harness" } })
    );
    expect(observation.ok).toBe(true);
    expect(observation.diffPreview).toContain("+ hola harness");
    expect(readFileSync(join(workspacePath, "notes/hello.txt"), "utf8")).toBe("hola harness");
    expect(eventTypes).toEqual(["agent:tool-call", "agent:observation"]);
  });

  it("reads back a file created via the runner", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    await runner.execute(makeInput({ tool: "fileEdit", workspacePath, args: { path: "a.txt", content: "abc" } }));
    const observation = await runner.execute(makeInput({ tool: "fileRead", workspacePath, args: { path: "a.txt" } }));
    expect(observation.ok).toBe(true);
    expect(observation.output).toBe("abc");
  });

  it("blocks path traversal outside the workspace", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    const observation = await runner.execute(
      makeInput({ tool: "fileRead", workspacePath, args: { path: "../../outside.txt" } })
    );
    expect(observation.ok).toBe(false);
    expect(observation.output).toMatch(/escapes workspace/);
  });

  it("supports undo of the last file edit", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    writeFileSync(join(workspacePath, "undo.txt"), "before", "utf8");
    await runner.execute(makeInput({ tool: "fileEdit", workspacePath, args: { path: "undo.txt", content: "after" } }));
    expect(readFileSync(join(workspacePath, "undo.txt"), "utf8")).toBe("after");
    runner.undoLastFileEdit();
    expect(readFileSync(join(workspacePath, "undo.txt"), "utf8")).toBe("before");
  });

  it("asks for confirmation when permission is ask", async () => {
    const runner = new ToolRunner({ permission: "ask", confirm: async () => false });
    const observation = await runner.execute(
      makeInput({ tool: "fileEdit", workspacePath, args: { path: "blocked.txt", content: "x" } })
    );
    expect(observation.ok).toBe(false);
    expect(observation.blocked).toBe(true);
    expect(existsSync(join(workspacePath, "blocked.txt"))).toBe(false);
  });

  it("runs a terminal command inside the workspace dir", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    const observation = await runner.execute(
      makeInput({ tool: "terminal", workspacePath, args: { command: "node", args: ["-e", "process.stdout.write(process.cwd())"] } })
    );
    expect(observation.ok).toBe(true);
    expect(observation.output.replace(/\\/g, "/").toLowerCase()).toContain(workspacePath.replace(/\\/g, "/").slice(-12).toLowerCase());
  });

  it("reports a failing terminal command as error observation", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    const observation = await runner.execute(
      makeInput({ tool: "terminal", workspacePath, args: { command: "node", args: ["-e", "process.exit(3)"] } })
    );
    expect(observation.ok).toBe(false);
    expect(observation.exitCode).toBe(3);
  });

  it("loads mcp config, routes tools and redacts secrets", async () => {
    writeFileSync(
      join(workspacePath, ".mcp.json"),
      JSON.stringify({ mcpServers: { shell: { command: "node", args: [], env: { TOKEN: "sk-abcdefgh12345678" } } } }),
      "utf8"
    );
    const { config } = loadMcpConfig(workspacePath);
    const route = routeMcpTool("shell__exec", config);
    expect(route).toEqual({ serverName: "shell", toolName: "exec" });
    const redacted = redactMcpEnv(config);
    expect(redacted.mcpServers["shell"].env["TOKEN"]).not.toContain("sk-abcdefgh");
    expect(redactSecrets("key sk-abcdefgh12345678 here")).toBe("key [REDACTED] here");
    const statuses = await healthCheckMcp(config);
    expect(statuses[0].reachable).toBe(true);
  });

  it("runs the llm tool loop until a final answer", async () => {
    const runner = new ToolRunner({ permission: "allow" });
    let callCount = 0;
    const fakeGateway = {
      collect: async (prompt: string): Promise<string> => {
        callCount += 1;
        if (callCount === 1) {
          const payload = JSON.stringify({
            tool: "fileEdit",
            args: { path: "loop.txt", content: "from-loop" },
            sessionId: "sess-loop",
            workspaceHash: "hash13",
            workspacePath,
          });
          return `voy a escribir el archivo\n\`\`\`tool\n${payload}\n\`\`\``;
        }
        expect(prompt).toContain("[observation:fileEdit:ok]");
        return "listo, archivo creado";
      },
    };
    const result = await runner.runAgentLoop(fakeGateway, "write file loop.txt");
    expect(result.toolCalls).toBe(1);
    expect(result.finalText).toBe("listo, archivo creado");
    expect(readFileSync(join(workspacePath, "loop.txt"), "utf8")).toBe("from-loop");
  });

  it("denies a tool call when the per-tool policy is deny", async () => {
    const runner = new ToolRunner({ permission: "allow", permissionFor: () => "deny" });
    const observation = await runner.execute(makeInput({ tool: "fileEdit", workspacePath, args: { path: "blocked.txt", content: "x" } }));
    expect(observation.blocked).toBe(true);
    expect(observation.ok).toBe(false);
    expect(existsSync(join(workspacePath, "blocked.txt"))).toBe(false);
  });

  it("asks for approval and honors reject", async () => {
    const requested: string[] = [];
    const runner = new ToolRunner({
      permission: "allow",
      permissionFor: () => "ask",
      approveTool: async (request) => {
        requested.push(request.tool);
        return { approved: false };
      },
    });
    const observation = await runner.execute(makeInput({ tool: "terminal", workspacePath, args: { command: "git", args: ["status"] } }));
    expect(requested).toEqual(["terminal"]);
    expect(observation.blocked).toBe(true);
  });

  it("executes once approval flows through", async () => {
    const runner = new ToolRunner({
      permission: "allow",
      permissionFor: () => "ask",
      approveTool: async () => ({ approved: true, remember: "allow" }),
    });
    const observation = await runner.execute(makeInput({ tool: "fileEdit", workspacePath, args: { path: "approved.txt", content: "ok" } }));
    expect(observation.ok).toBe(true);
    expect(readFileSync(join(workspacePath, "approved.txt"), "utf8")).toBe("ok");
  });
});
