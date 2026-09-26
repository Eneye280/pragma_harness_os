export type GraphNodeKind = "file" | "namespace";

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: string[][];
  updatedAt: number;
}

export interface GraphDelta {
  added: string[];
  removed: string[];
  changed: string[];
  graph: DependencyGraph;
}
