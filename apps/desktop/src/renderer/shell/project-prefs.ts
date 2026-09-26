import type { ProjectGroup } from "./project-tree";

export interface ProjectPrefs {
  pinned: string[];
  hidden: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROJECT_PREFS_KEY = "pragma-harness:project-prefs";

export function normalizeProjectPath(path: string): string {
  return path.replace(/[\\/]+/g, "/").replace(/\/+$/, "").toLowerCase();
}

const EMPTY: ProjectPrefs = { pinned: [], hidden: [] };

export function loadProjectPrefs(storage: StorageLike): ProjectPrefs {
  try {
    const raw = storage.getItem(PROJECT_PREFS_KEY);
    if (!raw) return { ...EMPTY, pinned: [], hidden: [] };
    const parsed = JSON.parse(raw) as Partial<ProjectPrefs>;
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((entry): entry is string => typeof entry === "string") : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((entry): entry is string => typeof entry === "string") : [],
    };
  } catch {
    return { pinned: [], hidden: [] };
  }
}

export function saveProjectPrefs(storage: StorageLike, prefs: ProjectPrefs): void {
  try {
    storage.setItem(PROJECT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
}

function toggle(list: string[], path: string): string[] {
  const key = normalizeProjectPath(path);
  return list.some((entry) => normalizeProjectPath(entry) === key)
    ? list.filter((entry) => normalizeProjectPath(entry) !== key)
    : [...list, path];
}

export function togglePinned(prefs: ProjectPrefs, path: string): ProjectPrefs {
  return { ...prefs, pinned: toggle(prefs.pinned, path) };
}

export function toggleHidden(prefs: ProjectPrefs, path: string): ProjectPrefs {
  return { ...prefs, hidden: toggle(prefs.hidden, path) };
}

export function isPinned(prefs: ProjectPrefs, path: string): boolean {
  const key = normalizeProjectPath(path);
  return prefs.pinned.some((entry) => normalizeProjectPath(entry) === key);
}

export function isHidden(prefs: ProjectPrefs, path: string): boolean {
  const key = normalizeProjectPath(path);
  return prefs.hidden.some((entry) => normalizeProjectPath(entry) === key);
}

/** Filtra los ocultos y deja los fijados arriba (el activo siempre primero entre fijados). */
export function applyProjectPrefs(groups: ProjectGroup[], prefs: ProjectPrefs): ProjectGroup[] {
  const pinnedKeys = new Set(prefs.pinned.map(normalizeProjectPath));
  const hiddenKeys = new Set(prefs.hidden.map(normalizeProjectPath));
  const visible = groups.filter((group) => group.active || !hiddenKeys.has(normalizeProjectPath(group.path)));
  return [...visible].sort((left, right) => {
    const leftPinned = pinnedKeys.has(normalizeProjectPath(left.path)) ? 1 : 0;
    const rightPinned = pinnedKeys.has(normalizeProjectPath(right.path)) ? 1 : 0;
    if (leftPinned !== rightPinned) return rightPinned - leftPinned;
    return 0;
  });
}
