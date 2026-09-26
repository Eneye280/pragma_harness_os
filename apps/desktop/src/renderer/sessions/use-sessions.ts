import { useCallback, useEffect, useState } from "react";
import type { SessionSummary } from "@shared/session";

export interface UseSessionsResult {
  sessions: SessionSummary[];
  loading: boolean;
  refresh: () => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useSessions(workspacePath: string, currentSessionId: string): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    const bridge = window.harness?.sessions;
    if (!bridge) {
      setSessions([]);
      return;
    }
    setLoading(true);
    // Carga todas las sesiones (todos los proyectos) para no "cerrar" proyectos al cambiar.
    const request = bridge.listAll ? bridge.listAll() : bridge.list(workspacePath);
    request
      .then((result) => setSessions(result.sessions))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [workspacePath]);

  useEffect(() => {
    refresh();
  }, [refresh, currentSessionId]);

  const rename = useCallback(
    async (id: string, title: string) => {
      await window.harness?.sessions.rename(id, title);
      refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await window.harness?.sessions.delete(id);
      refresh();
    },
    [refresh]
  );

  return { sessions, loading, refresh, rename, remove };
}
