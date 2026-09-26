export interface Point {
  x: number;
  y: number;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DonutSegment {
  value: number;
  dash: number;
  offset: number;
}

export function niceMax(values: number[]): number {
  const max = Math.max(1, ...values);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

export function sparklinePath(values: number[], width: number, height: number, padding = 2): string {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const step = values.length === 1 ? 0 : innerWidth / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y = padding + innerHeight - (value / max) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function barRects(values: number[], width: number, height: number, gap = 4): BarRect[] {
  if (values.length === 0) return [];
  const max = niceMax(values);
  const barWidth = Math.max(1, (width - gap * (values.length - 1)) / values.length);
  return values.map((value, index) => {
    const barHeight = Math.max(0, (value / max) * height);
    return { x: index * (barWidth + gap), y: height - barHeight, width: barWidth, height: barHeight };
  });
}

export function donutSegments(values: number[], radius: number, strokeWidth: number): { circumference: number; segments: DonutSegment[] } {
  const circumference = 2 * Math.PI * radius;
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let offset = 0;
  const segments = values.map((value) => {
    const dash = (value / total) * circumference;
    const segment = { value, dash, offset };
    offset += dash;
    return segment;
  });
  void strokeWidth;
  return { circumference, segments };
}
