import { useEffect, useMemo, useRef, useState } from "react";
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

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.4;

/** Monocromo: estado por tono de gris y borde. */
const NODE_STYLE: Record<RunNodeStatus, string> = {
  pending: "border-zinc-800 bg-[#0d0d0f] text-zinc-400",
  active: "border-zinc-300 bg-[#161619] text-zinc-100 run-node-active",
  done: "border-zinc-600 bg-[#111113] text-zinc-300",
  error: "border-dashed border-zinc-500 bg-[#111113] text-zinc-400",
};

const DOT_STYLE: Record<RunNodeStatus, string> = {
  pending: "bg-zinc-700",
  active: "bg-zinc-100 animate-pulse",
  done: "bg-zinc-400",
  error: "bg-zinc-500",
};

const ACTION_GLYPH: Record<RunAction, string> = {
  create: "+",
  modify: "~",
  delete: "−",
  read: "·",
  unknown: "?",
};

const LEGEND: RunAction[] = ["create", "modify", "delete", "read"];

export function RunGraphPanel({ graph, running, onOpenFile, onAssign, onStop }: RunGraphPanelProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const suppressClick = useRef(false);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const base = useMemo(() => layoutRunGraph(graph), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const nodeKey = useMemo(() => graph.nodes.map((node) => node.id).join("|"), [graph]);

  useEffect(() => {
    setMoved({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [nodeKey]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const [id, position] of base.positions) map.set(id, moved[id] ?? position);
    for (const [id, position] of Object.entries(moved)) if (!map.has(id)) map.set(id, position);
    return map;
  }, [base, moved]);

  const { contentWidth, contentHeight } = useMemo(() => {
    let width = base.width;
    let height = base.height;
    for (const [id, position] of positions) {
      const isRequest = byId.get(id)?.kind === "request";
      width = Math.max(width, position.x + RUN_NODE_WIDTH);
      height = Math.max(height, position.y + (isRequest ? REQUEST_NODE_HEIGHT : RUN_NODE_HEIGHT));
    }
    return { contentWidth: width, contentHeight: height };
  }, [positions, base, byId]);

  const request = byId.get(REQUEST_NODE_ID);
  const fileCount = graph.nodes.filter((node) => node.kind === "file").length;

  function startPan(event: React.MouseEvent): void {
    if (event.button !== 0) return;
    const start = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    const move = (moveEvent: MouseEvent): void => setPan({ x: moveEvent.clientX - start.x, y: moveEvent.clientY - start.y });
    const up = (): void => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startNodeDrag(event: React.MouseEvent, node: RunNode): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    const origin = positions.get(node.id) ?? { x: 0, y: 0 };
    const startClient = { x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    const move = (moveEvent: MouseEvent): void => {
      const dx = (moveEvent.clientX - startClient.x) / zoomRef.current;
      const dy = (moveEvent.clientY - startClient.y) / zoomRef.current;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick.current = true;
      setMoved((current) => ({ ...current, [node.id]: { x: origin.x + dx, y: origin.y + dy } }));
    };
    const up = (): void => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function step(delta: number): void {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))));
  }

  function resetView(): void {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setMoved({});
  }

  function openNode(node: RunNode): void {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (node.path) onOpenFile(node.path);
  }

  function submitEdit(): void {
    const text = draft.trim();
    if (text) onAssign(text);
    setEditing(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-4 py-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Grafo del run</span>
        <span className="text-[12px] text-zinc-500">{fileCount} archivo(s) · {graph.edges.length} conexión(es)</span>
        <span className="ml-auto flex items-center gap-1.5">
          {LEGEND.map((action) => (
            <span key={action} className="rounded-pill border border-hairline px-1.5 py-[1px] text-[12px] text-zinc-400">
              <span aria-hidden="true" className="mr-1 text-zinc-300">{ACTION_GLYPH[action]}</span>
              {RUN_ACTION_LABEL[action]}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Alejar" onClick={() => step(-0.2)} className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline text-zinc-400 hover:text-zinc-100">
            <span aria-hidden="true">−</span>
          </button>
          <span className="w-10 text-center font-mono text-[12px] text-zinc-500">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Acercar" onClick={() => step(0.2)} className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline text-zinc-400 hover:text-zinc-100">
            <span aria-hidden="true">+</span>
          </button>
          <button type="button" onClick={resetView} className="rounded-control border border-hairline px-2 py-[2px] text-[12px] text-zinc-400 hover:text-zinc-100">
            Reencuadrar
          </button>
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
          <button type="button" onClick={submitEdit} className="rounded-control bg-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-900 hover:bg-white">
            Reenviar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-surface-raised">
            Cancelar
          </button>
        </div>
      ) : null}

      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-surface active:cursor-grabbing"
        onMouseDown={startPan}
        onWheel={(event) => {
          event.preventDefault();
          step(event.deltaY < 0 ? 0.08 : -0.08);
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: contentWidth, height: contentHeight }}
        >
          <svg className="pointer-events-none absolute left-0 top-0" width={contentWidth} height={contentHeight} aria-hidden="true">
            {graph.edges.map((edge) => {
              const fromNode = byId.get(edge.from);
              const toNode = byId.get(edge.to);
              const fromPos = positions.get(edge.from);
              const toPos = positions.get(edge.to);
              if (!fromNode || !toNode || !fromPos || !toPos) return null;
              const from = nodeAnchor(fromPos, fromNode.kind === "request" ? "request" : "file", "bottom");
              const to = nodeAnchor(toPos, toNode.kind === "request" ? "request" : "file", "top");
              const active = fromNode.status === "active" || toNode.status === "active";
              return (
                <line
                  key={`${edge.from}->${edge.to}->${edge.kind}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={active ? "#a1a1aa" : edge.kind === "depends" ? "#27272a" : "#3f3f46"}
                  strokeWidth={active ? 1.75 : 1}
                  strokeDasharray={edge.kind === "depends" ? "5 6" : undefined}
                  className={active ? "run-edge run-edge-active" : "run-edge"}
                />
              );
            })}
          </svg>

          {request ? (
            <div
              onMouseDown={(event) => startNodeDrag(event, request)}
              className="absolute flex cursor-grab flex-col gap-1 rounded-control border border-zinc-600 bg-[#111113] px-3 py-2.5 shadow-[var(--phs-elevation-1)]"
              style={{ left: positions.get(REQUEST_NODE_ID)?.x ?? 0, top: positions.get(REQUEST_NODE_ID)?.y ?? 0, width: RUN_NODE_WIDTH, height: REQUEST_NODE_HEIGHT }}
            >
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" aria-hidden="true" />
                <span className="text-[12px] uppercase tracking-label text-zinc-400">petición</span>
                <span className="ml-auto text-[12px] text-zinc-500">{running ? "en curso" : "listo"}</span>
              </span>
              <p className="line-clamp-2 shrink-0 text-[13px] leading-snug text-zinc-100" title={graph.request}>{request.label}</p>
              <span className="flex flex-wrap items-center gap-1" onMouseDown={(event) => event.stopPropagation()}>
                {running ? (
                  <button type="button" onClick={onStop} className="rounded-control border border-zinc-600 px-2 py-[2px] text-[12px] text-zinc-200 hover:bg-zinc-800">
                    Parar
                  </button>
                ) : null}
                <button type="button" onClick={() => onAssign(graph.request)} className="rounded-control border border-zinc-600 px-2 py-[2px] text-[12px] text-zinc-200 hover:bg-zinc-800">
                  {running ? "Añadir al run" : "Asignar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(graph.request);
                    setEditing(true);
                  }}
                  className="rounded-control border border-zinc-700 px-2 py-[2px] text-[12px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
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
                position={positions.get(node.id) ?? { x: 0, y: 0 }}
                onMouseDown={(event) => startNodeDrag(event, node)}
                onOpen={() => openNode(node)}
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
  onMouseDown,
  onOpen,
}: {
  node: RunNode;
  position: { x: number; y: number };
  onMouseDown: (event: React.MouseEvent) => void;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onOpen}
      title={node.path}
      className={cn(
        "absolute flex cursor-grab flex-col items-start overflow-hidden rounded-control border px-3 py-2 text-left transition-colors hover:border-zinc-500",
        NODE_STYLE[node.status],
      )}
      style={{ left: position.x, top: position.y, width: RUN_NODE_WIDTH, height: RUN_NODE_HEIGHT }}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_STYLE[node.status])} aria-hidden="true" />
        <span className="truncate text-[13px]">{node.label}</span>
        <span className="ml-auto shrink-0 font-mono text-[12px] text-zinc-500" title={RUN_ACTION_LABEL[node.action]}>
          <span aria-hidden="true">{ACTION_GLYPH[node.action]}</span> {RUN_ACTION_LABEL[node.action]}
        </span>
      </span>
      <span className="mt-0.5 w-full truncate font-mono text-[12px] text-zinc-600">{node.path}</span>
    </button>
  );
}
