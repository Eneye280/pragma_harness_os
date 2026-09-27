export type RunNodeKind = "request" | "file";
export type RunAction = "read" | "create" | "modify" | "delete" | "unknown";
export type RunNodeStatus = "pending" | "active" | "done" | "error";
export type RunEdgeKind = "targets" | "depends";

export interface RunNode {
  id: string;
  kind: RunNodeKind;
  label: string;
  /** Ruta relativa normalizada; solo para `kind = "file"`. */
  path?: string;
  action: RunAction;
  status: RunNodeStatus;
}

export interface RunEdge {
  from: string;
  to: string;
  kind: RunEdgeKind;
}

export interface RunGraph {
  request: string;
  nodes: RunNode[];
  edges: RunEdge[];
  updatedAt: number;
}

/** Id del nodo raíz (la petición del usuario). */
export const REQUEST_NODE_ID = "req";

export const RUN_ACTION_LABEL: Record<RunAction, string> = {
  read: "leer",
  create: "crear",
  modify: "modificar",
  delete: "eliminar",
  unknown: "referencia",
};

export const RUN_STATUS_LABEL: Record<RunNodeStatus, string> = {
  pending: "pendiente",
  active: "en curso",
  done: "listo",
  error: "error",
};
