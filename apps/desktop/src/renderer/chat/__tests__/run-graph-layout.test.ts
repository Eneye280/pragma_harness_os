import { describe, expect, it } from "vitest";
import { REQUEST_NODE_ID, type RunGraph } from "@shared/run-graph";
import {
  REQUEST_NODE_HEIGHT,
  RUN_NODE_HEIGHT,
  RUN_NODE_WIDTH,
  RUN_V_GAP,
  layoutRunGraph,
  nodeAnchor,
} from "../run-graph-layout";

function graphWith(count: number): RunGraph {
  return {
    request: "x",
    nodes: [
      { id: REQUEST_NODE_ID, kind: "request", label: "x", action: "unknown", status: "done" },
      ...Array.from({ length: count }, (_, index) => ({
        id: `f${index}.ts`,
        kind: "file" as const,
        label: `f${index}.ts`,
        path: `f${index}.ts`,
        action: "read" as const,
        status: "pending" as const,
      })),
    ],
    edges: [],
    updatedAt: 1,
  };
}

describe("run graph layout", () => {
  it("places the request on top and the first row of files below it", () => {
    const layout = layoutRunGraph(graphWith(2));
    expect(layout.positions.get(REQUEST_NODE_ID)).toMatchObject({ y: 0 });
    expect(layout.positions.get("f0.ts")).toMatchObject({ y: REQUEST_NODE_HEIGHT + RUN_V_GAP });
  });

  it("wraps files into rows after the column limit", () => {
    const layout = layoutRunGraph(graphWith(5), 4);
    const first = layout.positions.get("f0.ts")!;
    const wrapped = layout.positions.get("f4.ts")!;
    expect(wrapped.y).toBeGreaterThan(first.y);
    expect(wrapped.x).toBe(layout.positions.get("f0.ts")!.x);
  });

  it("computes node anchors", () => {
    const position = { x: 10, y: 20 };
    expect(nodeAnchor(position, "file", "top")).toEqual({ x: 10 + RUN_NODE_WIDTH / 2, y: 20 });
    expect(nodeAnchor(position, "file", "bottom")).toEqual({ x: 10 + RUN_NODE_WIDTH / 2, y: 20 + RUN_NODE_HEIGHT });
    expect(nodeAnchor(position, "request", "bottom")).toEqual({ x: 10 + RUN_NODE_WIDTH / 2, y: 20 + REQUEST_NODE_HEIGHT });
  });
});
