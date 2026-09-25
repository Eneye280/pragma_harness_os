import { useCallback, useEffect, useState } from "react";
import type { HarnessSettings, ResolvedSettings } from "@shared/settings";

export interface UseSettingsResult {
  settings: HarnessSettings | null;
  resolved: ResolvedSettings | null;
  saving: boolean;
  error: string | null;
  testResult: { ok: boolean; reason: string } | null;
  save: (next: HarnessSettings) => Promise<boolean>;
  testProvider: () => Promise<void>;
  writeProfile: (name?: string) => Promise<void>;
  clearProfile: () => Promise<void>;
  refresh: () => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<HarnessSettings | null>(null);
  const [resolved, setResolved] = useState<ResolvedSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; reason: string } | null>(null);

  const refresh = useCallback(() => {
    const bridge = window.harness?.settings;
    if (!bridge) {
      setError("settings bridge unavailable");
      return;
    }
    bridge.get().then(setSettings).catch(() => setError("no se pudo leer la configuración"));
    bridge.resolved().then(setResolved).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const bridge = window.harness?.settings;
    if (!bridge) return;
    return bridge.onChanged((next) => setSettings(next));
  }, [refresh]);

  const save = useCallback(async (next: HarnessSettings): Promise<boolean> => {
    const bridge = window.harness?.settings;
    if (!bridge) return false;
    setSaving(true);
    setError(null);
    try {
      const result = await bridge.update(next);
      if ("error" in result) {
        setError(result.error);
        return false;
      }
      setSettings(result);
      const nextResolved = await bridge.resolved();
      setResolved(nextResolved);
      return true;
    } catch {
      setError("no se pudo guardar la configuración");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const testProvider = useCallback(async () => {
    const bridge = window.harness?.settings;
    if (!bridge) return;
    setTestResult(null);
    try {
      setTestResult(await bridge.testProvider());
    } catch {
      setTestResult({ ok: false, reason: "no se pudo probar el provider" });
    }
  }, []);

  const writeProfile = useCallback(async (name?: string) => {
    const bridge = window.harness?.settings;
    if (!bridge) return;
    try {
      await bridge.writeProfile(name);
      setResolved(await bridge.resolved());
    } catch {
      setError("no se pudo guardar el perfil del proyecto");
    }
  }, []);

  const clearProfile = useCallback(async () => {
    const bridge = window.harness?.settings;
    if (!bridge) return;
    try {
      await bridge.clearProfile();
      setResolved(await bridge.resolved());
    } catch {
      setError("no se pudo eliminar el perfil del proyecto");
    }
  }, []);

  return { settings, resolved, saving, error, testResult, save, testProvider, writeProfile, clearProfile, refresh };
}
