export interface SessionSummary {
  id: string;
  title: string;
  workspacePath: string;
  workspaceHash: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface SessionRecord {
  summary: SessionSummary;
  state: unknown;
}

export interface SessionSaveInput {
  id: string;
  workspacePath: string;
  workspaceHash: string;
  title?: string;
  messageCount?: number;
  state: unknown;
}
