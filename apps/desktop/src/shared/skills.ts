export interface SkillSummary {
  name: string;
  description: string;
  triggers: string[];
  needs: string[];
  priority: number;
  path: string;
  enabled: boolean;
}

export interface SkillCatalogSnapshot {
  skills: SkillSummary[];
  total: number;
  enabledCount: number;
}
