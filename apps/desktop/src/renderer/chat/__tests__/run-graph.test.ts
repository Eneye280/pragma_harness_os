import { describe, expect, it } from "vitest";
import type { HarnessContextSnapshot } from "@shared/context-snapshot";
import type { PlanProposal } from "@shared/plan";
import { REQUEST_NODE_ID } from "@shared/run-graph";
import { actionForTool, buildRunGraph, extractPathFromSummary } from "../run-graph";
import type { ToolCallState } from "../chat-reducer";

function context(files: string[], hits: string[] = []): HarnessContextSnapshot {
  return {
    sessionId: "s",
    skills: { names: [], sources: [], tokens: 0 },
    rules: { domain: "web", label: "G1-G10", tokens: 0 },
    rag: { hits: hits.map((path) => ({ path, score: 0.7, snippet: "" })), tokens: 0, indexSize: hits.length },
    files: { paths: files, tokens: 0 },
    instincts: { items: [], tokens: 0 },
    agent: null,
    tokens: { used: 0, limit: 8000 },
    model: "deepseek-flash",
    createdAt: 0,
  };
}

function plan(files: string[]): PlanProposal {
  return {
    sessionId: "s",
    title: "t",
    markdown: "",
    files,
    intent: { domain: "web", type: "feature", effort: "medium", needs: [] },
    revised: false,
    createdAt: 0,
  };
}

function tool(partial: Partial<ToolCallState> & { tool: string; summary: string }): ToolCallState {
  return { callId: partial.callId ?? partial.summary, status: "running", ...partial };
}

const EMPTY = { request: "x", plan: null, context: null, toolCalls: [], dependency: null };

describe("run graph builder", () => {
  it("starts with the request node and a deterministic timestamp", () => {
    const graph = buildRunGraph({ ...EMPTY, request: "crea la calculadora" }, 1);
    const request = graph.nodes.find((node) => node.id === REQUEST_NODE_ID);
    expect(request).toMatchObject({ kind: "request", label: "crea la calculadora" });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.updatedAt).toBe(1);
  });

  it("derives file nodes from the plan (modify) and the context (read)", () => {
    const graph = buildRunGraph(
      { ...EMPTY, plan: plan(["src/App.tsx"]), context: context(["src/index.ts"], ["docs/readme.md"]) },
      1,
    );
    const files = graph.nodes.filter((node) => node.kind === "file").map((node) => node.id).sort();
    expect(files).toEqual(["docs/readme.md", "src/App.tsx", "src/index.ts"]);
    expect(graph.nodes.find((node) => node.id === "src/App.tsx")?.action).toBe("modify");
    expect(graph.nodes.find((node) => node.id === "docs/readme.md")?.action).toBe("read");
    expect(graph.edges.filter((edge) => edge.kind === "targets")).toHaveLength(3);
  });

  it("maps tool calls to action and status", () => {
    const graph = buildRunGraph(
      {
        ...EMPTY,
        toolCalls: [
          tool({ tool: "fileDelete", summary: "delete src/old.ts", status: "running" }),
          tool({ tool: "fileEdit", summary: "edit src/App.tsx", status: "done", ok: true }),
          tool({ tool: "fileWrite", summary: "write src/new.ts", status: "done", ok: false }),
        ],
      },
      1,
    );
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    expect(byId.get("src/old.ts")).toMatchObject({ action: "delete", status: "active" });
    expect(byId.get("src/App.tsx")).toMatchObject({ action: "modify", status: "done" });
    expect(byId.get("src/new.ts")).toMatchObject({ action: "create", status: "error" });
  });

  it("connects files that depend on each other", () => {
    const graph = buildRunGraph(
      {
        ...EMPTY,
        plan: plan(["src/App.tsx", "src/util.ts"]),
        dependency: { nodes: [], edges: [{ from: "src/App.tsx", to: "src/util.ts" }], cycles: [], updatedAt: 0 },
      },
      1,
    );
    expect(graph.edges).toContainEqual({ from: "src/App.tsx", to: "src/util.ts", kind: "depends" });
  });

  it("extracts file paths and ignores plain words", () => {
    expect(extractPathFromSummary("edit src/renderer/App.tsx")).toBe("src/renderer/App.tsx");
    expect(extractPathFromSummary("no file here v1.0.3")).toBeNull();
    expect(extractPathFromSummary("sin ruta")).toBeNull();
  });

  it("classifies tool actions", () => {
    expect(actionForTool("fileRead", "read a")).toBe("read");
    expect(actionForTool("fileEdit", "edit b")).toBe("modify");
    expect(actionForTool("fileWrite", "write c")).toBe("create");
    expect(actionForTool("fileDelete", "delete d")).toBe("delete");
    expect(actionForTool("mystery", "algo sin verbo")).toBe("unknown");
  });
});
