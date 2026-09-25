import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { events, sessions, workspaces } from "./schema";
import type * as schema from "./schema";

export type HarnessEventType =
  | "message"
  | "harness:ingress"
  | "harness:classified"
  | "harness:skills-compiled"
  | "harness:context-assembled"
  | "agent:llm-call"
  | "agent:tool-call"
  | "agent:observation"
  | "harness:gate"
  | "harness:memory-write";

export interface HarnessEvent {
  id: string;
  type: HarnessEventType;
  payload: unknown;
  ts: number;
  sessionId: string;
  workspaceHash: string;
  seq: number;
}

export class EventLog {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  ensureWorkspace(hash: string, path: string): void {
    const existing = this.db.select().from(workspaces).where(eq(workspaces.hash, hash)).get();
    if (!existing) {
      this.db.insert(workspaces).values({ id: randomUUID(), path, hash, createdAt: new Date() }).run();
    }
  }

  ensureSession(sessionId: string, workspaceHash: string): void {
    const existing = this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    if (!existing) {
      this.db.insert(sessions).values({ id: sessionId, workspaceHash, createdAt: new Date() }).run();
    }
  }

  append(event: Omit<HarnessEvent, "id" | "ts" | "seq"> & Partial<Pick<HarnessEvent, "id" | "ts">>): HarnessEvent {
    const sessionId = event.sessionId;
    const workspaceHash = event.workspaceHash;
    this.ensureSession(sessionId, workspaceHash);

    const existingCount = this.db
      .select()
      .from(events)
      .where(eq(events.sessionId, sessionId))
      .all().length;

    const full: HarnessEvent = {
      id: event.id ?? randomUUID(),
      type: event.type,
      payload: event.payload,
      ts: event.ts ?? Date.now(),
      sessionId,
      workspaceHash,
      seq: existingCount,
    };

    this.db
      .insert(events)
      .values({
        id: full.id,
        sessionId: full.sessionId,
        workspaceHash: full.workspaceHash,
        type: full.type,
        payload: full.payload as never,
        ts: full.ts,
        seq: full.seq,
      })
      .run();

    return full;
  }

  getBySession(sessionId: string): HarnessEvent[] {
    const rows = this.db.select().from(events).where(eq(events.sessionId, sessionId)).orderBy(asc(events.seq)).all();
    return rows.map((r) => ({
      id: r.id,
      type: r.type as HarnessEventType,
      payload: r.payload as unknown,
      ts: r.ts,
      sessionId: r.sessionId,
      workspaceHash: r.workspaceHash,
      seq: r.seq,
    }));
  }

  getByWorkspace(workspaceHash: string, limit = 100): HarnessEvent[] {
    const rows = this.db
      .select()
      .from(events)
      .where(eq(events.workspaceHash, workspaceHash))
      .orderBy(asc(events.ts))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      type: r.type as HarnessEventType,
      payload: r.payload as unknown,
      ts: r.ts,
      sessionId: r.sessionId,
      workspaceHash: r.workspaceHash,
      seq: r.seq,
    }));
  }

  replay(sessionId: string): HarnessEvent[] {
    return this.getBySession(sessionId);
  }

  timeTravel(sessionId: string, index: number): HarnessEvent[] {
    const all = this.getBySession(sessionId);
    if (index < 0 || index >= all.length) throw new Error(`timeTravel: index ${index} out of bounds (0..${all.length - 1})`);
    return all.slice(0, index + 1);
  }

  countBySession(sessionId: string): number {
    return this.db.select().from(events).where(eq(events.sessionId, sessionId)).all().length;
  }

  clearSession(sessionId: string): void {
    this.db.delete(events).where(eq(events.sessionId, sessionId)).run();
  }
}
