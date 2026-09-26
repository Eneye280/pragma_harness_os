export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pragma-harness:theme";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export interface ThemeDocumentLike {
  documentElement: { setAttribute(name: string, value: string): void; style: { colorScheme: string } };
}

export function applyTheme(mode: ThemeMode, prefersDark: boolean, target: ThemeDocumentLike): ResolvedTheme {
  const resolved = resolveTheme(mode, prefersDark);
  target.documentElement.setAttribute("data-theme", resolved);
  target.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function loadThemeMode(storage: { getItem(key: string): string | null }): ThemeMode {
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function saveThemeMode(storage: { setItem(key: string, value: string): void }, mode: ThemeMode): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // storage unavailable
  }
}
