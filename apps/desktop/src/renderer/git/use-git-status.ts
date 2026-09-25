import { useCallback, useEffect, useState } from "react";
import type { GitStatus } from "@shared/git";

const POLL_MS = 5000;

export interface UseGitStatusResult {
  status: GitStatus | null;
  refresh: () => void;
}

export function useGitStatus(workspaceActive: string): UseGitStatusResult {
  const [status, setStatus] = useState<GitStatus | null>(null);

  const refresh = useCallback(() => {
    const bridge = window.harness?.git;
    if (!bridge) return;
    bridge.status().then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, workspaceActive]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    function onFocus(): void {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { status, refresh };
}
