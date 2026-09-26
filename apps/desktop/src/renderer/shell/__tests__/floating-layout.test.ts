import { describe, expect, it } from "vitest";
import {
  bringToFront,
  clampRect,
  closePanel,
  defaultRect,
  loadLayout,
  movePanel,
  openPanel,
  resizePanel,
  saveLayout,
  snapToEdges,
  toggleCollapsed,
  type FloatingLayout,
  type StorageLike,
} from "../floating-layout";

const viewport = { width: 1200, height: 800 };

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("floating layout", () => {
  it("creates a centered default rect", () => {
    const rect = defaultRect(viewport);
    expect(rect.width).toBeGreaterThanOrEqual(320);
    expect(rect.x).toBe(Math.round((viewport.width - rect.width) / 2));
    expect(rect.open).toBe(false);
  });

  it("clamps within the viewport", () => {
    const clamped = clampRect({ x: -50, y: 5000, width: 100, height: 100, open: true, collapsed: false, z: 1 }, viewport);
    expect(clamped.x).toBe(0);
    expect(clamped.width).toBe(320);
    expect(clamped.height).toBe(220);
    expect(clamped.y).toBeLessThanOrEqual(viewport.height);
  });

  it("snaps to the viewport edges", () => {
    const snapped = snapToEdges({ x: 5, y: 10, width: 300, height: 200, open: true, collapsed: false, z: 1 }, viewport);
    expect(snapped.x).toBe(0);
    expect(snapped.y).toBe(0);
    const right = snapToEdges({ x: 1200 - 300 - 4, y: 100, width: 300, height: 200, open: true, collapsed: false, z: 1 }, viewport);
    expect(right.x).toBe(900);
  });

  it("moves, resizes, collapses and raises panels", () => {
    let layout: FloatingLayout = { graph: { x: 100, y: 100, width: 400, height: 300, open: true, collapsed: false, z: 1 } };
    layout = movePanel(layout, "graph", 50, 0, viewport);
    expect(layout.graph.x).toBe(150);
    layout = resizePanel(layout, "graph", 100, 100, viewport);
    expect(layout.graph.width).toBe(500);
    layout = toggleCollapsed(layout, "graph");
    expect(layout.graph.collapsed).toBe(true);
    layout = openPanel(layout, "sessions", viewport);
    expect(layout.sessions.open).toBe(true);
    layout = bringToFront(layout, "graph");
    expect(layout.graph.z).toBeGreaterThan(layout.sessions.z);
    layout = closePanel(layout, "graph");
    expect(layout.graph.open).toBe(false);
  });

  it("persists and restores the layout per project", () => {
    const storage = memoryStorage();
    const layout: FloatingLayout = { graph: { x: 12, y: 24, width: 500, height: 400, open: true, collapsed: false, z: 3 } };
    saveLayout(storage, "/repo/a", layout);
    expect(loadLayout(storage, "/repo/a")).toEqual(layout);
    expect(loadLayout(storage, "/repo/b")).toEqual({});
  });

  it("survives corrupt storage", () => {
    const storage = memoryStorage();
    storage.data["pragma-harness:layout:/repo/x"] = "{not json";
    expect(loadLayout(storage, "/repo/x")).toEqual({});
  });
});
