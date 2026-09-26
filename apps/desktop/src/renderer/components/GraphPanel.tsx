import { useEffect, useMemo, useRef, useState } from "react";
import type { DependencyGraph, GraphDelta } from "@shared/graph";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../shell/use-focus-trap";
import {
  bringToFront,
  clampRect,
  defaultRect,
  loadLayout,
  movePanel,
  resizePanel,
  saveLayout,
  toggleCollapsed,
  type FloatingLayout,
  type StorageLike,
} from "../shell/floating-layout";

interface GraphPanelProps {
  open: boolean;
  onClose: () => void;
  storageKey?: string;
}

const MAX_NODES = 160;
const PANEL_ID = "graph";

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function GraphPanel({ open, onClose, storageKey = "" }: GraphPanelProps): React.ReactElement | null {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [delta, setDelta] = useState<GraphDelta | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState<FloatingLayout>(() => (browserStorage() ? loadLayout(browserStorage()!, storageKey) : {}));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useFocusTrap(open, onClose);

  useEffect(() => {
    const storage = browserStorage();
    if (!storage) return;
    setLayout(loadLayout(storage, storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setLayout((current) => {
      const base = current[PANEL_ID] ? current : { ...current, [PANEL_ID]: { ...defaultRect(viewport), open: true } };
      return { ...base, [PANEL_ID]: clampRect({ ...base[PANEL_ID], open: true }, viewport) };
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const storage = browserStorage();
    if (storage) saveLayout(storage, storageKey, layout);
  }, [layout, open, storageKey]);

  useEffect(() => {
    if (!open) return;
    void window.harness?.graph.get().then((next) => setGraph(next ?? null));
    const off = window.harness?.graph.onUpdated((nextDelta) => {
      setDelta(nextDelta);
      setGraph(nextDelta.graph);
    });
    return () => off?.();
  }, [open]);

  const graphLayout = useMemo(() => {
    if (!graph) return { positions: new Map<string, { x: number; y: number }>(), nodes: [], edges: [] };
    // Se muestran TODOS los nodos (también los aislados: html/css/js sin imports).
    const nodes = graph.nodes.slice(0, MAX_NODES);
    const positions = new Map<string, { x: number; y: number }>();
    const count = Math.max(1, nodes.length);
    const radius = nodes.length <= 1 ? 0 : Math.max(120, count * 5);
    nodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2;
      positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    const edges = graph.edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
    return { positions, nodes, edges };
  }, [graph]);

  if (!open) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const rect = layout[PANEL_ID] ?? { ...defaultRect(viewport), open: true };

  function beginDrag(event: React.MouseEvent): void {
    event.preventDefault();
    let last = { x: event.clientX, y: event.clientY };
    const onMove = (moveEvent: MouseEvent): void => {
      const dx = moveEvent.clientX - last.x;
      const dy = moveEvent.clientY - last.y;
      last = { x: moveEvent.clientX, y: moveEvent.clientY };
      setLayout((current) => movePanel(current, PANEL_ID, dx, dy, viewport));
    };
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function beginResize(event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    let last = { x: event.clientX, y: event.clientY };
    const onMove = (moveEvent: MouseEvent): void => {
      const dw = moveEvent.clientX - last.x;
      const dh = moveEvent.clientY - last.y;
      last = { x: moveEvent.clientX, y: moveEvent.clientY };
      setLayout((current) => resizePanel(current, PANEL_ID, dw, dh, viewport));
    };
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const cycleIds = new Set((graph?.cycles ?? []).flat());
  const cycleEdgeKeys = new Set((graph?.cycles ?? []).flatMap((cycle) => cycle.map((id, index) => `${id}->${cycle[(index + 1) % cycle.length]}`)));
  const neighbors = new Set(focus ? graphLayout.edges.filter((edge) => edge.from === focus || edge.to === focus).flatMap((edge) => [edge.from, edge.to]) : []);

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onMouseDown={onClose}>
      <div
        ref={containerRef}
        className="sheet absolute flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Grafo de dependencias"
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.collapsed ? 42 : rect.height, zIndex: rect.z }}
        onMouseDown={(event) => {
          event.stopPropagation();
          setLayout((current) => bringToFront(current, PANEL_ID));
        }}
      >
        <div className="flex cursor-grab items-center gap-3 border-b border-hairline px-3 py-2" onMouseDown={beginDrag}>
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-harness-soft">Dependency graph</span>
          <span className="text-[12px] text-zinc-500">{graph ? `${graph.nodes.length} nodos · ${graph.edges.length} aristas · ${graph.cycles.length} ciclos` : "—"}</span>
          {delta ? (
            <span className="rounded-full bg-harness/15 px-2 py-[1px] text-[12px] text-harness-soft">
              +{delta.added.length} −{delta.removed.length} ~{delta.changed.length}
            </span>
          ) : null}
          <button type="button" aria-label="Colapsar grafo" onClick={() => setLayout((current) => toggleCollapsed(current, PANEL_ID))} className="ml-auto rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800">
            {rect.collapsed ? "▸" : "▾"}
          </button>
          <button type="button" onClick={() => void window.harness?.graph.refresh().then((next) => setGraph(next ?? null))} className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800">
            Recalcular
          </button>
          <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        {rect.collapsed ? null : (
          <>
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
          <svg width="100%" height="100%" viewBox="-420 -320 840 640" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Grafo de dependencias">
            <g transform={`scale(${zoom}) translate(${pan.x},${pan.y})`}>
              {graphLayout.edges.map((edge) => {
                const from = graphLayout.positions.get(edge.from)!;
                const to = graphLayout.positions.get(edge.to)!;
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
              {graphLayout.nodes.map((node) => {
                const position = graphLayout.positions.get(node.id)!;
                const isFocus = focus === node.id;
                const isNeighbor = neighbors.has(node.id);
                const inCycle = cycleIds.has(node.id);
                return (
                  <g key={node.id} transform={`translate(${position.x},${position.y})`} onClick={() => setFocus(isFocus ? null : node.id)} className="cursor-pointer">
                    <circle r={isFocus ? 6 : 4} fill={inCycle ? "#f87171" : isFocus ? "#a78bfa" : isNeighbor ? "#c4b5fd" : "#71717a"} />
                    <text x={8} y={3} className={cn("text-[12px]", isFocus ? "fill-zinc-100" : "fill-zinc-500")}>
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          {graph && graph.nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <p className="max-w-[320px] text-center text-[12px] leading-relaxed text-zinc-500">
                Sin dependencias todavía. El grafo lee imports de TS/JS/C# y referencias de HTML/CSS
                (<span className="font-mono">&lt;script src&gt;</span>, <span className="font-mono">import</span>, <span className="font-mono">using</span>).
              </p>
            </div>
          ) : null}
          {focus ? <p className="absolute bottom-2 left-3 font-mono text-[12px] text-zinc-400">{focus}</p> : null}
        </div>

        {graph && graph.cycles.length > 0 ? (
          <div className="max-h-24 overflow-y-auto border-t border-hairline px-3 py-2">
            <p className="text-[12px] uppercase tracking-widest text-red-400">ciclos</p>
            <ul className="mt-1 space-y-0.5">
              {graph.cycles.map((cycle, index) => (
                <li key={`${cycle.join(">")}-${index}`} className="truncate font-mono text-[12px] text-zinc-500">{cycle.join(" → ")}</li>
              ))}
            </ul>
          </div>
        ) : null}
          </>
        )}
        <div
          role="separator"
          aria-label="Redimensionar grafo"
          onMouseDown={beginResize}
          className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize rounded-tl bg-hairline-strong/60"
        />
      </div>
    </div>
  );
}
