import { useCallback, useEffect, useState } from "react";
import { applyAccent, applyTheme, loadThemeMode, resolveTheme, saveThemeMode, type ResolvedTheme, type ThemeMode } from "./theme";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccentId, resolveAccent } from "./accents";

export interface UseThemeResult {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
}

function prefersDarkNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
}

function loadAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    return resolveAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function useTheme(): UseThemeResult {
  const [mode, setModeState] = useState<ThemeMode>(() => (typeof window === "undefined" ? "system" : loadThemeMode(window.localStorage)));
  const [accent, setAccentState] = useState<string>(() => loadAccent());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode, prefersDarkNow()));

  useEffect(() => {
    const next = applyTheme(mode, prefersDarkNow(), document as unknown as Parameters<typeof applyTheme>[2]);
    setResolved(next);
  }, [mode]);

  useEffect(() => {
    applyAccent(accent, document as unknown as Parameters<typeof applyAccent>[1]);
  }, [accent]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (): void => setResolved(applyTheme(mode, query.matches, document as unknown as Parameters<typeof applyTheme>[2]));
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") saveThemeMode(window.localStorage, next);
  }, []);

  const setAccent = useCallback((next: string) => {
    const safe = isAccentId(next) ? next : DEFAULT_ACCENT;
    setAccentState(safe);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, safe);
    } catch {
      // storage unavailable
    }
  }, []);

  return { mode, resolved, accent, setMode, setAccent };
}
