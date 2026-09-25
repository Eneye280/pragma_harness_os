import { useEffect, useState } from "react";
import type { CostSnapshot } from "@shared/cost";

export function useCost(): CostSnapshot | null {
  const [cost, setCost] = useState<CostSnapshot | null>(null);

  useEffect(() => {
    const bridge = window.harness?.cost;
    if (!bridge) return;
    bridge.get().then(setCost).catch(() => undefined);
    return bridge.onUpdated((snapshot) => setCost(snapshot));
  }, []);

  return cost;
}
