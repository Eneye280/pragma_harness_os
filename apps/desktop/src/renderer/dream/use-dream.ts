import { useEffect, useState } from "react";
import type { DreamNotification } from "@shared/dream";

const DISMISS_MS = 7000;
const MAX_VISIBLE = 3;

export function useDream(): DreamNotification[] {
  const [learned, setLearned] = useState<DreamNotification[]>([]);

  useEffect(() => {
    const bridge = window.harness?.dream;
    if (!bridge) return;
    return bridge.onLearned((notification) => {
      setLearned((current) => [...current, notification].slice(-MAX_VISIBLE));
      setTimeout(() => {
        setLearned((current) => current.filter((entry) => entry.ts !== notification.ts || entry.trigger !== notification.trigger));
      }, DISMISS_MS);
    });
  }, []);

  return learned;
}
