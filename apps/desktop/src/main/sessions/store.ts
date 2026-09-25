import type { SessionRecord, SessionSaveInput, SessionSummary } from "../../shared/session";
import type { SessionRepository } from "./repository";

export const DEFAULT_SESSION_TITLE = "Nueva sesión";
const TITLE_MAX = 60;

interface PersistedStateShape {
  messages?: Array<{ role?: string; content?: string }>;
}

export function deriveTitle(existingTitle: string | null, state: unknown, explicitTitle?: string): string {
  if (explicitTitle && explicitTitle.trim()) return explicitTitle.trim().slice(0, TITLE_MAX);
  if (existingTitle && existingTitle !== DEFAULT_SESSION_TITLE) return existingTitle;
  const shape = (state ?? {}) as PersistedStateShape;
  const firstUser = shape.messages?.find((message) => message.role === "user" && message.content);
  if (firstUser?.content) return firstUser.content.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  return DEFAULT_SESSION_TITLE;
}

export function countMessages(state: unknown): number {
  const shape = (state ?? {}) as PersistedStateShape;
  return Array.isArray(shape.messages) ? shape.messages.length : 0;
}

export class SessionStore {
  constructor(
    private readonly repo: SessionRepository,
    private readonly now: () => number = Date.now
  ) {}

  save(input: SessionSaveInput): SessionSummary {
    const existing = this.repo.get(input.id);
    const timestamp = this.now();
    return this.repo.upsert({
      id: input.id,
      title: deriveTitle(existing?.summary.title ?? null, input.state, input.title),
      workspacePath: input.workspacePath,
      workspaceHash: input.workspaceHash,
      messageCount: input.messageCount ?? countMessages(input.state),
      createdAt: existing?.summary.createdAt ?? timestamp,
      updatedAt: timestamp,
      state: input.state,
    });
  }

  list(workspaceHash: string, limit = 50): SessionSummary[] {
    return this.repo.list(workspaceHash, limit);
  }

  get(id: string): SessionRecord | null {
    return this.repo.get(id);
  }

  latest(workspaceHash: string): SessionRecord | null {
    return this.repo.latest(workspaceHash);
  }

  rename(id: string, title: string): SessionSummary | null {
    const trimmed = title.trim().slice(0, TITLE_MAX);
    return trimmed ? this.repo.rename(id, trimmed) : null;
  }

  remove(id: string): void {
    this.repo.remove(id);
  }
}
