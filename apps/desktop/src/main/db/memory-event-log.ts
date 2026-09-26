import { randomUUID } from "crypto";

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
  | "harness:memory-write"
  | "plan:decision";

export interface HarnessEvent {
  id: string;
  type: HarnessEventType;
  payload: unknown;
  ts: number;
  sessionId: string;
  workspaceHash: string;
  seq: number;
}

export class MemoryEventLog {
  private workspaces = new Map<string, { id: string; path: string; hash: string }>();
  private sessions = new Map<string, { workspaceHash: string }>();
  private events: HarnessEvent[] = [];

  ensureWorkspace(hash: string, path: string): void {
    if (!this.workspaces.has(hash)) this.workspaces.set(hash, { id: randomUUID(), path, hash });
  }

  ensureSession(sessionId: string, workspaceHash: string): void {
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, { workspaceHash });
  }

  append(event: Omit<HarnessEvent, "id" | "ts" | "seq"> & Partial<Pick<HarnessEvent, "id" | "ts">>): HarnessEvent {
    this.ensureSession(event.sessionId, event.workspaceHash);
    const count = this.events.filter((e) => e.sessionId === event.sessionId).length;
    const full: HarnessEvent = {
      id: event.id ?? randomUUID(),
      type: event.type,
      payload: event.payload,
      ts: event.ts ?? Date.now(),
      sessionId: event.sessionId,
      workspaceHash: event.workspaceHash,
      seq: count,
    };
    this.events.push(full);
    return full;
  }

  getBySession(sessionId: string): HarnessEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId).sort((a, b) => a.seq - b.seq);
  }

  getByWorkspace(workspaceHash: string, limit = 100): HarnessEvent[] {
    return this.events
      .filter((e) => e.workspaceHash === workspaceHash)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, limit);
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
    return this.events.filter((e) => e.sessionId === sessionId).length;
  }

  allEvents(): HarnessEvent[] {
    return [...this.events].sort((a, b) => a.ts - b.ts);
  }

  clearSession(sessionId: string): void {
    this.events = this.events.filter((e) => e.sessionId !== sessionId);
  }
}
