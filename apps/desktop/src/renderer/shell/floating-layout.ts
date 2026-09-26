export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  collapsed: boolean;
  z: number;
}

export type FloatingLayout = Record<string, FloatingRect>;

export interface Viewport {
  width: number;
  height: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const FLOATING_LIMITS = { minWidth: 320, minHeight: 220, maxWidth: 1600, maxHeight: 1400 } as const;
export const SNAP_THRESHOLD = 18;
export const LAYOUT_STORAGE_PREFIX = "pragma-harness:layout:";

export function defaultRect(viewport: Viewport, overrides: Partial<FloatingRect> = {}): FloatingRect {
  const width = Math.min(900, Math.max(FLOATING_LIMITS.minWidth, viewport.width - 160));
  const height = Math.min(640, Math.max(FLOATING_LIMITS.minHeight, viewport.height - 160));
  return {
    x: Math.round((viewport.width - width) / 2),
    y: Math.round((viewport.height - height) / 2),
    width,
    height,
    open: false,
    collapsed: false,
    z: 1,
    ...overrides,
  };
}

export function clampRect(rect: FloatingRect, viewport: Viewport): FloatingRect {
  const width = Math.min(FLOATING_LIMITS.maxWidth, Math.max(FLOATING_LIMITS.minWidth, Math.round(rect.width)));
  const height = Math.min(FLOATING_LIMITS.maxHeight, Math.max(FLOATING_LIMITS.minHeight, Math.round(rect.height)));
  const maxX = Math.max(0, viewport.width - width);
  const maxY = Math.max(0, viewport.height - Math.min(height, FLOATING_LIMITS.minHeight));
  return {
    ...rect,
    width,
    height,
    x: Math.min(maxX, Math.max(0, Math.round(rect.x))),
    y: Math.min(maxY, Math.max(0, Math.round(rect.y))),
  };
}

export function snapToEdges(rect: FloatingRect, viewport: Viewport): FloatingRect {
  let { x, y } = rect;
  if (Math.abs(x) <= SNAP_THRESHOLD) x = 0;
  if (Math.abs(viewport.width - (x + rect.width)) <= SNAP_THRESHOLD) x = viewport.width - rect.width;
  if (Math.abs(y) <= SNAP_THRESHOLD) y = 0;
  return { ...rect, x, y };
}

export function movePanel(layout: FloatingLayout, id: string, dx: number, dy: number, viewport: Viewport): FloatingLayout {
  const rect = layout[id];
  if (!rect) return layout;
  const moved = snapToEdges({ ...rect, x: rect.x + dx, y: rect.y + dy }, viewport);
  return { ...layout, [id]: clampRect(moved, viewport) };
}

export function resizePanel(layout: FloatingLayout, id: string, dw: number, dh: number, viewport: Viewport): FloatingLayout {
  const rect = layout[id];
  if (!rect) return layout;
  return { ...layout, [id]: clampRect({ ...rect, width: rect.width + dw, height: rect.height + dh }, viewport) };
}

export function bringToFront(layout: FloatingLayout, id: string): FloatingLayout {
  const rect = layout[id];
  if (!rect) return layout;
  const othersMax = Math.max(0, ...Object.entries(layout).filter(([key]) => key !== id).map(([, entry]) => entry.z));
  if (rect.z > othersMax) return layout;
  return { ...layout, [id]: { ...rect, z: othersMax + 1 } };
}

export function toggleCollapsed(layout: FloatingLayout, id: string): FloatingLayout {
  const rect = layout[id];
  if (!rect) return layout;
  return { ...layout, [id]: { ...rect, collapsed: !rect.collapsed } };
}

export function openPanel(layout: FloatingLayout, id: string, viewport: Viewport): FloatingLayout {
  const rect = layout[id] ?? defaultRect(viewport);
  return bringToFront({ ...layout, [id]: { ...rect, open: true } }, id);
}

export function closePanel(layout: FloatingLayout, id: string): FloatingLayout {
  const rect = layout[id];
  if (!rect) return layout;
  return { ...layout, [id]: { ...rect, open: false } };
}

export function storageKeyFor(workspacePath: string): string {
  return `${LAYOUT_STORAGE_PREFIX}${workspacePath || "default"}`;
}

export function loadLayout(storage: StorageLike, workspacePath: string): FloatingLayout {
  try {
    const raw = storage.getItem(storageKeyFor(workspacePath));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as FloatingLayout;
  } catch {
    return {};
  }
}

export function saveLayout(storage: StorageLike, workspacePath: string, layout: FloatingLayout): void {
  try {
    storage.setItem(storageKeyFor(workspacePath), JSON.stringify(layout));
  } catch {
    // storage unavailable: layout stays in-memory for the session
  }
}
