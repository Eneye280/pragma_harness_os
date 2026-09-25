export interface PlanIntent {
  domain: string;
  type: string;
  effort: string;
  needs: string[];
}

export interface PlanProposal {
  sessionId: string;
  title: string;
  markdown: string;
  files: string[];
  intent: PlanIntent;
  revised: boolean;
  createdAt: number;
}

export type PlanDecision = { action: "approve"; markdown: string } | { action: "discard" };
