import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { SessionRecord, SessionSummary } from "../../shared/session";
import type { SessionRepository, StoredSession } from "./repository";

export class JsonSessionRepository implements SessionRepository {
  private cache: Map<string, StoredSession> | null = null;

  constructor(private readonly baseDir: string) {}

  private file(id: string): string {
    return join(this.baseDir, `${id}.json`);
  }

  private ensureCache(): Map<string, StoredSession> {
    if (this.cache) return this.cache;
    const map = new Map<string, StoredSession>();
    try {
      for (const entry of readdirSync(this.baseDir)) {
        if (!entry.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(readFileSync(join(this.baseDir, entry), "utf8")) as StoredSession;
          if (parsed?.summary?.id) map.set(parsed.summary.id, parsed);
        } catch {
          continue;
        }
      }
    } catch {
      // directory does not exist yet
    }
    this.cache = map;
    return map;
  }

  private persist(row: StoredSession): void {
    mkdirSync(this.baseDir, { recursive: true });
    writeFileSync(this.file(row.summary.id), `${JSON.stringify(row, null, 2)}\n`, "utf8");
  }

  upsert(row: SessionSummary & { state: unknown }): SessionSummary {
    const map = this.ensureCache();
    const existing = map.get(row.id);
    const summary: SessionSummary = {
      id: row.id,
      title: row.title,
      workspacePath: row.workspacePath,
      workspaceHash: row.workspaceHash,
      createdAt: existing?.summary.createdAt ?? row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
    };
    const stored: StoredSession = { summary, state: row.state };
    map.set(row.id, stored);
    this.persist(stored);
    return summary;
  }

  list(workspaceHash: string, limit: number): SessionSummary[] {
    return [...this.ensureCache().values()]
      .map((row) => row.summary)
      .filter((summary) => summary.workspaceHash === workspaceHash)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  }

  listAll(limit: number): SessionSummary[] {
    return [...this.ensureCache().values()]
      .map((row) => row.summary)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  }

  get(id: string): SessionRecord | null {
    const row = this.ensureCache().get(id);
    return row ? { summary: row.summary, state: row.state } : null;
  }

  latest(workspaceHash: string): SessionRecord | null {
    const [first] = this.list(workspaceHash, 1);
    return first ? this.get(first.id) : null;
  }

  rename(id: string, title: string): SessionSummary | null {
    const map = this.ensureCache();
    const row = map.get(id);
    if (!row) return null;
    row.summary = { ...row.summary, title };
    this.persist(row);
    return row.summary;
  }

  remove(id: string): void {
    this.ensureCache().delete(id);
    const file = this.file(id);
    if (existsSync(file)) unlinkSync(file);
  }
}
