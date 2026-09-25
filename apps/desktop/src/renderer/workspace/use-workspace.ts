import { useCallback, useEffect, useState } from "react";
import type { WorkspaceState } from "@shared/workspace";

export interface UseWorkspaceResult {
  active: string;
  recents: string[];
  busy: boolean;
  pick: () => Promise<void>;
  activate: (path: string) => Promise<void>;
}

export function useWorkspace(): UseWorkspaceResult {
  const [state, setState] = useState<WorkspaceState>({ active: "", recents: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.harness?.workspace;
    if (!bridge) return;
    void bridge.get().then(setState);
    return bridge.onChanged((payload) => setState({ active: payload.active, recents: payload.recents }));
  }, []);

  const pick = useCallback(async () => {
    const bridge = window.harness?.workspace;
    if (!bridge) return;
    setBusy(true);
    try {
      const result = await bridge.pick();
      setState(result.state);
    } finally {
      setBusy(false);
    }
  }, []);

  const activate = useCallback(async (path: string) => {
    const bridge = window.harness?.workspace;
    if (!bridge) return;
    setBusy(true);
    try {
      const result = await bridge.activate(path);
      setState(result.state);
    } finally {
      setBusy(false);
    }
  }, []);

  return { active: state.active, recents: state.recents, busy, pick, activate };
}
