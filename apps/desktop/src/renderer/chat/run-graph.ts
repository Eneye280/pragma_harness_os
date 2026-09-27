import type { HarnessContextSnapshot } from "@shared/context-snapshot";
import type { DependencyGraph } from "@shared/graph";
import type { PlanProposal } from "@shared/plan";
import {
  REQUEST_NODE_ID,
  type RunAction,
  type RunEdge,
  type RunGraph,
  type RunNode,
  type RunNodeStatus,
} from "@shared/run-graph";
import type { ToolCallState } from "./chat-reducer";

export interface BuildRunGraphInput {
  request: string;
  plan: PlanProposal | null;
  context: HarnessContextSnapshot | null;
  toolCalls: ToolCallState[];
  dependency: DependencyGraph | null;
}

const FILE_EXTENSIONS =
  "tsx?|jsx?|mjs|cjs|json|ya?ml|toml|md|css|scss|less|html?|cs|lua|sql|py|rb|rs|go|java|kt|php|sh|ps1|txt|csv|xml|svg|glsl|wgsl|dockerfile";
const PATH_PATTERN = new RegExp(`[\\w./\\\\@-]+\\.(?:${FILE_EXTENSIONS})\\b`, "i");

const STATUS_RANK: Record<RunNodeStatus, number> = { pending: 0, active: 1, done: 2, error: 3 };

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

/** Extrae la primera ruta con extensión conocida de un resumen de tool call. */
export function extractPathFromSummary(summary: string): string | null {
  const match = summary.match(PATH_PATTERN);
  return match ? normalizePath(match[0]) : null;
}

/** Acción probable de una tool a partir de su nombre y el resumen. */
export function actionForTool(tool: string, summary: string): RunAction {
  const name = tool.toLowerCase();
  if (/(write|create|add|new)/.test(name)) return "create";
  if (/(edit|patch|modify|update|apply|rename|move)/.test(name)) return "modify";
  if (/(delete|remove|unlink|rm)/.test(name)) return "delete";
  if (/(read|open|cat|view|list|glob|grep|search)/.test(name)) return "read";
  const text = summary.toLowerCase();
  if (/(crear|crea|create|nuevo)/.test(text)) return "create";
  if (/(borrar|elimina|delete|remove)/.test(text)) return "delete";
  if (/(modificar|editar|actualiza|edit|update)/.test(text)) return "modify";
  return "unknown";
}

function truncate(text: string, max = 52): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "—";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Deriva el grafo de ejecución de un run a partir de datos ya presentes en el
 * renderer (plan, contexto, tool calls y grafo de dependencias del repo).
 * Puro y determinista salvo `updatedAt` (inyectable para tests).
 */
export function buildRunGraph(input: BuildRunGraphInput, now: number = Date.now()): RunGraph {
  const nodes = new Map<string, RunNode>();
  const labels = new Map<string, string>();

  labels.set(REQUEST_NODE_ID, truncate(input.request || "petición"));
  nodes.set(REQUEST_NODE_ID, {
    id: REQUEST_NODE_ID,
    kind: "request",
    label: labels.get(REQUEST_NODE_ID)!,
    action: "unknown",
    status: "done",
  });

  function ensureFile(path: string, action: RunAction, status: RunNodeStatus): void {
    const id = normalizePath(path);
    if (!id) return;
    const existing = nodes.get(id);
    if (existing) {
      if (action !== "unknown" && existing.action === "read") existing.action = action;
      if (action === "create" && existing.action === "modify") existing.action = "create";
      if (STATUS_RANK[status] > STATUS_RANK[existing.status]) existing.status = status;
      return;
    }
    nodes.set(id, { id, kind: "file", label: id.split("/").pop() ?? id, path: id, action, status });
  }

  for (const file of input.plan?.files ?? []) ensureFile(file, "modify", "pending");
  for (const path of input.context?.files.paths ?? []) ensureFile(path, "read", "pending");
  for (const hit of input.context?.rag.hits ?? []) ensureFile(hit.path, "read", "pending");

  for (const call of input.toolCalls) {
    const path = extractPathFromSummary(call.summary);
    if (!path) continue;
    const status: RunNodeStatus =
      call.status === "running" ? "active" : call.status === "done" ? (call.ok === false ? "error" : "done") : "error";
    ensureFile(path, actionForTool(call.tool, call.summary), status);
  }

  const edges: RunEdge[] = [];
  for (const node of nodes.values()) {
    if (node.kind === "file") edges.push({ from: REQUEST_NODE_ID, to: node.id, kind: "targets" });
  }
  for (const edge of input.dependency?.edges ?? []) {
    const from = normalizePath(edge.from);
    const to = normalizePath(edge.to);
    if (from !== to && nodes.has(from) && nodes.has(to)) edges.push({ from, to, kind: "depends" });
  }

  const uniqueEdges = [...new Map(edges.map((edge) => [`${edge.from}->${edge.to}->${edge.kind}`, edge])).values()];
  return { request: input.request, nodes: [...nodes.values()], edges: uniqueEdges, updatedAt: now };
}
