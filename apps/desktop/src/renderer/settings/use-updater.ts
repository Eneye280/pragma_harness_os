import { useCallback, useEffect, useState } from "react";
import type { UpdateStatus } from "@shared/updater";

export interface UseUpdaterResult {
  status: UpdateStatus | null;
  busy: boolean;
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
}

export function useUpdater(): UseUpdaterResult {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.harness?.updater;
    if (!bridge) return;
    void bridge.getStatus().then(setStatus);
    return bridge.onStatus(setStatus);
  }, []);

  const check = useCallback(async () => {
    const bridge = window.harness?.updater;
    if (!bridge) return;
    setBusy(true);
    try {
      setStatus(await bridge.check());
    } finally {
      setBusy(false);
    }
  }, []);

  const download = useCallback(async () => {
    const bridge = window.harness?.updater;
    if (!bridge) return;
    setBusy(true);
    try {
      setStatus(await bridge.download());
    } finally {
      setBusy(false);
    }
  }, []);

  const install = useCallback(async () => {
    await window.harness?.updater?.install();
  }, []);

  return { status, busy, check, download, install };
}
