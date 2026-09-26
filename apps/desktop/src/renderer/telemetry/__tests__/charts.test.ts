import { describe, expect, it } from "vitest";
import { barRects, donutSegments, niceMax, sparklinePath } from "../charts";

describe("telemetry charts math", () => {
  it("rounds the axis max to a nice value", () => {
    expect(niceMax([3])).toBe(5);
    expect(niceMax([12])).toBe(20);
    expect(niceMax([0])).toBe(1);
    expect(niceMax([230])).toBe(250);
  });

  it("builds a sparkline path inside the box", () => {
    const path = sparklinePath([0, 5, 10], 100, 40);
    expect(path.startsWith("M")).toBe(true);
    expect(path.split(" ")).toHaveLength(3);
    expect(path.endsWith("L98.00,2.00")).toBe(true);
    expect(sparklinePath([], 100, 40)).toBe("");
  });

  it("builds bars that fit the width and scale by max", () => {
    const rects = barRects([10, 5], 104, 40, 4);
    expect(rects).toHaveLength(2);
    expect(rects[0].width).toBe(50);
    expect(rects[1].x).toBe(54);
    expect(rects[0].height).toBeGreaterThan(rects[1].height);
    expect(barRects([], 100, 40)).toEqual([]);
  });

  it("splits a donut into proportional segments", () => {
    const { circumference, segments } = donutSegments([1, 1], 10, 4);
    expect(circumference).toBeCloseTo(2 * Math.PI * 10, 5);
    expect(segments[0].dash).toBeCloseTo(segments[1].dash, 5);
    expect(segments[1].offset).toBeCloseTo(segments[0].dash, 5);
  });
});
