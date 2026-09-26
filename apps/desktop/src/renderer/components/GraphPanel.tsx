import { useEffect, useMemo, useRef, useState } from "react";
import type { DependencyGraph, GraphDelta } from "@shared/graph";
import { cn } from "../lib/cn";

interface GraphPanelProps {
  open: boolean;
  onClose: () => void;
}

const MAX_NODES = 160;

export function GraphPanel({ open, onClose }: GraphPanelProps): React.ReactElement | null {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [delta, setDelta] = useState<GraphDelta | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    void window.harness?.graph.get().then((next) => setGraph(next ?? null));
    const off = window.harness?.graph.onUpdated((nextDelta) => {
      setDelta(nextDelta);
      setGraph(nextDelta.graph);
    });
    return () => off?.();
  }, [open]);

  const layout = useMemo(() => {
    if (!graph) return { positions: new Map<string, { x: number; y: number }>(), nodes: [], edges: [] };
    const connected = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
    const nodes = graph.nodes.filter((node) => connected.has(node.id)).slice(0, MAX_NODES);
    const positions = new Map<string, { x: number; y: number }>();
    const radius = Math.max(160, nodes.length * 6);
    nodes.forEach((node, index) => {
      const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
      positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    const edges = graph.edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
    return { positions, nodes, edges };
  }, [graph]);

  if (!open) return null;

  const cycleIds = new Set((graph?.cycles ?? []).flat());
  const cycleEdgeKeys = new Set((graph?.cycles ?? []).flatMap((cycle) => cycle.map((id, index) => `${id}->${cycle[(index + 1) % cycle.length]}`)));
  const neighbors = new Set(focus ? layout.edges.filter((edge) => edge.from === focus || edge.to === focus).flatMap((edge) => [edge.from, edge.to]) : []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Grafo de dependencias">
      <div className="flex h-[82vh] w-full max-w-5xl flex-col rounded-panel border border-hairline bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-hairline px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Dependency graph</span>
          <span className="text-[11px] text-zinc-500">{graph ? `${graph.nodes.length} nodos · ${graph.edges.length} aristas · ${graph.cycles.length} ciclos` : "—"}</span>
          {delta ? (
            <span className="rounded-full bg-harness/15 px-2 py-[1px] text-[10px] text-harness-soft">
              +{delta.added.length} −{delta.removed.length} ~{delta.changed.length}
            </span>
          ) : null}
          <button type="button" onClick={() => void window.harness?.graph.refresh().then((next) => setGraph(next ?? null))} className="ml-auto rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">
            Recalcular
          </button>
          <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-hidden bg-surface"
          onWheel={(event) => {
            event.preventDefault();
            setZoom((current) => Math.min(3, Math.max(0.3, current - event.deltaY * 0.001)));
          }}
          onMouseDown={(event) => {
            dragRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
          }}
          onMouseMove={(event) => {
            if (!dragRef.current) return;
            setPan({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y });
          }}
          onMouseUp={() => {
            dragRef.current = null;
          }}
        >
          <svg width="100%" height="100%" role="img" aria-label="Grafo de dependencias">
            <g transform={`translate(50%,50%) scale(${zoom}) translate(${pan.x},${pan.y})`}>
              {layout.edges.map((edge) => {
                const from = layout.positions.get(edge.from)!;
                const to = layout.positions.get(edge.to)!;
                const isCycle = cycleEdgeKeys.has(`${edge.from}->${edge.to}`);
                const dim = focus && !(edge.from === focus || edge.to === focus);
                return (
                  <line
                    key={`${edge.from}->${edge.to}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isCycle ? "#f87171" : dim ? "#27272a" : "#3f3f46"}
                    strokeWidth={isCycle ? 1.6 : 1}
                  />
                );
              })}
              {layout.nodes.map((node) => {
                const position = layout.positions.get(node.id)!;
                const isFocus = focus === node.id;
                const isNeighbor = neighbors.has(node.id);
                const inCycle = cycleIds.has(node.id);
                return (
                  <g key={node.id} transform={`translate(${position.x},${position.y})`} onClick={() => setFocus(isFocus ? null : node.id)} className="cursor-pointer">
                    <circle r={isFocus ? 6 : 4} fill={inCycle ? "#f87171" : isFocus ? "#a78bfa" : isNeighbor ? "#c4b5fd" : "#71717a"} />
                    <text x={8} y={3} className={cn("text-[9px]", isFocus ? "fill-zinc-100" : "fill-zinc-500")}>
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          {focus ? <p className="absolute bottom-2 left-3 font-mono text-[10px] text-zinc-400">{focus}</p> : null}
        </div>

        {graph && graph.cycles.length > 0 ? (
          <div className="max-h-24 overflow-y-auto border-t border-hairline px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-red-400">ciclos</p>
            <ul className="mt-1 space-y-0.5">
              {graph.cycles.map((cycle, index) => (
                <li key={`${cycle.join(">")}-${index}`} className="truncate font-mono text-[10px] text-zinc-500">{cycle.join(" → ")}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
