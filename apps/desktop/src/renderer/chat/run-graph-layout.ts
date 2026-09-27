import { REQUEST_NODE_ID, type RunGraph } from "@shared/run-graph";

export const RUN_NODE_WIDTH = 196;
export const RUN_NODE_HEIGHT = 58;
export const REQUEST_NODE_HEIGHT = 78;
export const RUN_H_GAP = 30;
export const RUN_V_GAP = 60;

export interface RunGraphLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/**
 * Layout determinista del grafo de ejecución: la petición arriba, al centro, y
 * los archivos en una rejilla debajo. Devuelve posiciones top-left por id.
 */
export function layoutRunGraph(graph: RunGraph, columns = 4): RunGraphLayout {
  const positions = new Map<string, { x: number; y: number }>();
  const files = graph.nodes.filter((node) => node.kind === "file");
  const cols = Math.max(1, Math.min(columns, Math.max(1, files.length)));
  const rows = Math.ceil(files.length / cols);
  const gridWidth = cols * RUN_NODE_WIDTH + (cols - 1) * RUN_H_GAP;

  positions.set(REQUEST_NODE_ID, { x: Math.max(0, (gridWidth - RUN_NODE_WIDTH) / 2), y: 0 });

  files.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.set(node.id, {
      x: col * (RUN_NODE_WIDTH + RUN_H_GAP),
      y: REQUEST_NODE_HEIGHT + RUN_V_GAP + row * (RUN_NODE_HEIGHT + RUN_V_GAP),
    });
  });

  const width = Math.max(gridWidth, RUN_NODE_WIDTH);
  const height = REQUEST_NODE_HEIGHT + RUN_V_GAP + rows * (RUN_NODE_HEIGHT + RUN_V_GAP);

  return { positions, width, height };
}

/** Punto de anclaje (centro abajo / centro arriba) de un nodo ya posicionado. */
export function nodeAnchor(
  position: { x: number; y: number },
  kind: "request" | "file",
  side: "top" | "bottom",
): { x: number; y: number } {
  const height = kind === "request" ? REQUEST_NODE_HEIGHT : RUN_NODE_HEIGHT;
  return { x: position.x + RUN_NODE_WIDTH / 2, y: side === "top" ? position.y : position.y + height };
}
