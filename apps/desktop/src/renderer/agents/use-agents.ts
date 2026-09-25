import { useCallback, useEffect, useState } from "react";
import type { AgentSummary } from "@shared/agents";

export interface UseAgentsResult {
  agents: AgentSummary[];
  active: AgentSummary | null;
  loading: boolean;
  select: (id: string) => Promise<void>;
  refresh: () => void;
}

export function useAgents(workspaceActive: string): UseAgentsResult {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const bridge = window.harness?.agents;
    if (!bridge) {
      setLoading(false);
      return;
    }
    setLoading(true);
    bridge
      .list()
      .then(setAgents)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, workspaceActive]);

  const select = useCallback(async (id: string) => {
    const bridge = window.harness?.agents;
    if (!bridge) return;
    const result = await bridge.select(id);
    setAgents(result.agents);
  }, []);

  return { agents, active: agents.find((agent) => agent.active) ?? null, loading, select, refresh };
}
