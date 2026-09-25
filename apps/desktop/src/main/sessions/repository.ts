import type { SessionRecord, SessionSaveInput, SessionSummary } from "../../shared/session";

export interface StoredSession {
  summary: SessionSummary;
  state: unknown;
}

export interface SessionRepository {
  upsert(row: SessionSummary & { state: unknown }): SessionSummary;
  list(workspaceHash: string, limit: number): SessionSummary[];
  get(id: string): SessionRecord | null;
  latest(workspaceHash: string): SessionRecord | null;
  rename(id: string, title: string): SessionSummary | null;
  remove(id: string): void;
}

export type SessionSave = SessionSaveInput;

export class MemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, StoredSession>();

  upsert(row: SessionSummary & { state: unknown }): SessionSummary {
    const existing = this.rows.get(row.id);
    const summary: SessionSummary = existing ? { ...row, createdAt: existing.summary.createdAt } : row;
    this.rows.set(row.id, { summary, state: row.state });
    return summary;
  }

  list(workspaceHash: string, limit: number): SessionSummary[] {
    return [...this.rows.values()]
      .map((row) => row.summary)
      .filter((summary) => summary.workspaceHash === workspaceHash)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  }

  get(id: string): SessionRecord | null {
    const row = this.rows.get(id);
    return row ? { summary: row.summary, state: row.state } : null;
  }

  latest(workspaceHash: string): SessionRecord | null {
    const [first] = this.list(workspaceHash, 1);
    return first ? this.get(first.id) : null;
  }

  rename(id: string, title: string): SessionSummary | null {
    const row = this.rows.get(id);
    if (!row) return null;
    row.summary = { ...row.summary, title };
    return row.summary;
  }

  remove(id: string): void {
    this.rows.delete(id);
  }
}
