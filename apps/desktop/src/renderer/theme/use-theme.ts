import { useCallback, useEffect, useState } from "react";
import { applyTheme, loadThemeMode, resolveTheme, saveThemeMode, type ResolvedTheme, type ThemeMode } from "./theme";

export interface UseThemeResult {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

function prefersDarkNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
}

export function useTheme(): UseThemeResult {
  const [mode, setModeState] = useState<ThemeMode>(() => (typeof window === "undefined" ? "system" : loadThemeMode(window.localStorage)));
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode, prefersDarkNow()));

  useEffect(() => {
    const next = applyTheme(mode, prefersDarkNow(), document as unknown as Parameters<typeof applyTheme>[2]);
    setResolved(next);
  }, [mode]);

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

  return { mode, resolved, setMode };
}
