import { useMemo, useState } from "react";
import {
  REQUEST_NODE_ID,
  RUN_ACTION_LABEL,
  type RunAction,
  type RunEdge,
  type RunGraph,
  type RunNode,
  type RunNodeStatus,
} from "@shared/run-graph";
import { cn } from "../lib/cn";
import {
  REQUEST_NODE_HEIGHT,
  RUN_NODE_HEIGHT,
  RUN_NODE_WIDTH,
  layoutRunGraph,
  nodeAnchor,
} from "./run-graph-layout";

interface RunGraphPanelProps {
  graph: RunGraph;
  running: boolean;
  onOpenFile: (path: string) => void;
  onAssign: (text: string) => void;
  onStop: () => void;
}

const STATUS_STYLE: Record<RunNodeStatus, string> = {
  pending: "border-hairline bg-surface/85",
  active: "border-harness/60 bg-harness/10 run-node-active",
  done: "border-emerald-500/50 bg-emerald-500/10",
  error: "border-red-500/50 bg-red-500/10",
};

const STATUS_DOT: Record<RunNodeStatus, string> = {
  pending: "bg-zinc-600",
  active: "bg-harness animate-pulse",
  done: "bg-emerald-400",
  error: "bg-red-400",
};

const ACTION_TONE: Record<RunAction, string> = {
  create: "bg-emerald-500/15 text-emerald-300",
  modify: "bg-amber-500/15 text-amber-300",
  delete: "bg-red-500/15 text-red-300",
  read: "bg-surface-raised text-zinc-400",
  unknown: "bg-surface-raised text-zinc-500",
};

const LEGEND: RunAction[] = ["create", "modify", "delete", "read"];

export function RunGraphPanel({ graph, running, onOpenFile, onAssign, onStop }: RunGraphPanelProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const layout = useMemo(() => layoutRunGraph(graph), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const request = byId.get(REQUEST_NODE_ID);
  const fileCount = graph.nodes.filter((node) => node.kind === "file").length;
  const activeIds = useMemo(
    () => new Set(graph.nodes.filter((node) => node.status === "active").map((node) => node.id)),
    [graph],
  );

  function edgeActive(edge: RunEdge): boolean {
    return activeIds.has(edge.to) || activeIds.has(edge.from);
  }

  function submitEdit(): void {
    const text = draft.trim();
    if (text) onAssign(text);
    setEditing(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-4 py-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Grafo del run</span>
        <span className="text-[12px] text-zinc-500">{fileCount} archivo(s) · {graph.edges.length} conexión(es)</span>
        <span className="ml-auto flex items-center gap-1.5">
          {LEGEND.map((action) => (
            <span key={action} className={cn("rounded-pill px-1.5 py-[1px] text-[12px]", ACTION_TONE[action])}>
              {RUN_ACTION_LABEL[action]}
            </span>
          ))}
        </span>
      </header>

      {editing ? (
        <div className="flex shrink-0 items-end gap-2 border-b border-hairline px-4 py-2">
          <textarea
            autoFocus
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitEdit();
              }
              if (event.key === "Escape") setEditing(false);
            }}
            aria-label="Editar la petición"
            className="field max-h-32 min-w-0 flex-1 resize-none px-2.5 py-1.5 text-[13px] text-zinc-200"
          />
          <button type="button" onClick={submitEdit} className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong">
            Reenviar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-surface-raised">
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto bg-surface/40 p-5">
        <div className="relative" style={{ width: layout.width, height: layout.height, minWidth: "100%" }}>
          <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height} aria-hidden="true">
            {graph.edges.map((edge) => {
              const fromNode = byId.get(edge.from);
              const toNode = byId.get(edge.to);
              const fromPos = layout.positions.get(edge.from);
              const toPos = layout.positions.get(edge.to);
              if (!fromNode || !toNode || !fromPos || !toPos) return null;
              const from = nodeAnchor(fromPos, fromNode.kind === "request" ? "request" : "file", "bottom");
              const to = nodeAnchor(toPos, toNode.kind === "request" ? "request" : "file", "top");
              const active = edgeActive(edge);
              return (
                <line
                  key={`${edge.from}->${edge.to}->${edge.kind}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={active ? "#a78bfa" : edge.kind === "depends" ? "#52525b" : "#3f3f46"}
                  strokeWidth={active ? 2 : 1.25}
                  strokeDasharray={edge.kind === "depends" ? "5 5" : undefined}
                  className={active ? "run-edge run-edge-active" : "run-edge"}
                />
              );
            })}
          </svg>

          {request ? (
            <div
              className="absolute flex flex-col justify-center rounded-control border border-harness/40 bg-harness/15 px-3 py-2 shadow-[var(--phs-elevation-1)]"
              style={{ left: layout.positions.get(REQUEST_NODE_ID)?.x ?? 0, top: 0, width: RUN_NODE_WIDTH, height: REQUEST_NODE_HEIGHT }}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] uppercase tracking-label text-harness-soft">petición</span>
                <span className="ml-auto text-[12px] text-zinc-400">{running ? "en curso" : "listo"}</span>
              </span>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-100" title={graph.request}>{request.label}</p>
              <span className="mt-1 flex flex-wrap items-center gap-1">
                {running ? (
                  <button type="button" onClick={onStop} className="rounded-control border border-red-500/40 bg-red-500/10 px-2 py-[2px] text-[12px] text-red-300 hover:bg-red-500/20">
                    Parar
                  </button>
                ) : null}
                <button type="button" onClick={() => onAssign(graph.request)} className="rounded-control border border-harness/40 bg-harness/15 px-2 py-[2px] text-[12px] text-harness-soft hover:bg-harness/25">
                  {running ? "Añadir al run" : "Asignar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(graph.request);
                    setEditing(true);
                  }}
                  className="rounded-control border border-hairline px-2 py-[2px] text-[12px] text-zinc-300 hover:bg-surface-raised"
                >
                  Modificar
                </button>
              </span>
            </div>
          ) : null}

          {graph.nodes
            .filter((node) => node.kind === "file")
            .map((node) => (
              <FileNode
                key={node.id}
                node={node}
                position={layout.positions.get(node.id) ?? { x: 0, y: 0 }}
                onOpen={() => (node.path ? onOpenFile(node.path) : undefined)}
              />
            ))}
        </div>

        {fileCount === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-[320px] text-center text-[12px] leading-relaxed text-zinc-500">
              Aún no hay archivos en este run. Cuando el harness compile contexto, proponga un plan o ejecute
              tools, aparecerán aquí con su acción (crear, modificar, eliminar) y sus dependencias.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FileNode({
  node,
  position,
  onOpen,
}: {
  node: RunNode;
  position: { x: number; y: number };
  onOpen: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={node.path}
      className={cn(
        "absolute flex flex-col items-start overflow-hidden rounded-control border px-3 py-2 text-left transition-colors",
        STATUS_STYLE[node.status],
        node.path ? "cursor-pointer hover:border-harness/60" : "cursor-default",
      )}
      style={{ left: position.x, top: position.y, width: RUN_NODE_WIDTH, height: RUN_NODE_HEIGHT }}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[node.status])} aria-hidden="true" />
        <span className="truncate text-[12px] text-zinc-200">{node.label}</span>
        <span className={cn("ml-auto shrink-0 rounded-pill px-1.5 text-[12px]", ACTION_TONE[node.action])}>{RUN_ACTION_LABEL[node.action]}</span>
      </span>
      {node.path ? <span className="mt-0.5 w-full truncate font-mono text-[12px] text-zinc-600">{node.path}</span> : null}
    </button>
  );
}
