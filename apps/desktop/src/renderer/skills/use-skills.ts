import { useCallback, useEffect, useState } from "react";
import type { SkillSummary } from "@shared/skills";

export interface UseSkillsResult {
  skills: SkillSummary[];
  loading: boolean;
  toggle: (name: string, enabled: boolean) => Promise<void>;
  refresh: () => void;
}

export function useSkills(workspaceActive: string): UseSkillsResult {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const bridge = window.harness?.skills;
    if (!bridge) {
      setLoading(false);
      return;
    }
    setLoading(true);
    bridge
      .list()
      .then(setSkills)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, workspaceActive]);

  const toggle = useCallback(
    async (name: string, enabled: boolean) => {
      const bridge = window.harness?.skills;
      if (!bridge) return;
      const result = await bridge.setEnabled(name, enabled);
      setSkills(result.skills);
    },
    []
  );

  return { skills, loading, toggle, refresh };
}
