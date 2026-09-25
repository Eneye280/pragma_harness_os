import { describe, it, expect, beforeEach } from "vitest";
import { getTableColumns } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { EventLog } from "../event-log";
import { events, sessions, workspaces } from "../schema";
import type * as schema from "../schema";

type Row = Record<string, unknown>;

const COLUMN_TO_PROPERTY = new Map<string, string>();
for (const table of [workspaces, sessions, events]) {
  for (const [property, column] of Object.entries(getTableColumns(table))) {
    COLUMN_TO_PROPERTY.set((column as { name: string }).name, property);
  }
}

function matchCondition(condition: unknown, row: Row): boolean {
  const chunks = (condition as { queryChunks?: Array<Record<string, unknown>> } | undefined)?.queryChunks ?? [];
  const column = chunks.find((chunk) => chunk && typeof chunk.name === "string");
  const value = chunks.find((chunk) => chunk && chunk.value !== undefined && typeof chunk.value !== "object");
  if (!column) return true;
  const property = COLUMN_TO_PROPERTY.get(column.name as string) ?? (column.name as string);
  return row[property] === value?.value;
}

function makeFakeDb() {
  const tables = new Map<object, Row[]>();
  const rowsOf = (table: object): Row[] => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table) as Row[];
  };

  const db = {
    select() {
      let table: object | null = null;
      let condition: unknown;
      let limitCount: number | undefined;
      const api = {
        from(next: object) {
          table = next;
          return api;
        },
        where(next: unknown) {
          condition = next;
          return api;
        },
        orderBy() {
          return api;
        },
        limit(count: number) {
          limitCount = count;
          return api;
        },
        all(): Row[] {
          let rows = [...rowsOf(table as object)];
          if (condition) rows = rows.filter((row) => matchCondition(condition, row));
          rows.sort((left, right) => Number(left.ts ?? 0) - Number(right.ts ?? 0));
          if (limitCount !== undefined) rows = rows.slice(0, limitCount);
          return rows;
        },
        get(): Row | undefined {
          return api.all()[0];
        },
      };
      return api;
    },
    insert(table: object) {
      return {
        values(row: Row) {
          return {
            run() {
              rowsOf(table).push({ ...row });
            },
          };
        },
      };
    },
    delete(table: object) {
      return {
        where(condition: unknown) {
          return {
            run() {
              tables.set(
                table,
                rowsOf(table).filter((row) => !matchCondition(condition, row))
              );
            },
          };
        },
      };
    },
  };

  return db as unknown as BetterSQLite3Database<typeof schema>;
}

let db: BetterSQLite3Database<typeof schema>;
let log: EventLog;

beforeEach(() => {
  db = makeFakeDb();
  log = new EventLog(db);
});

describe("EventLog — append-only repository, replay and timeTravel", () => {
  it("lazily creates workspace and session and appends in seq order", () => {
    log.append({ type: "harness:ingress", payload: { msg: "hola" }, sessionId: "s1", workspaceHash: "ws1" });
    log.append({ type: "harness:classified", payload: { domain: "backend" }, sessionId: "s1", workspaceHash: "ws1" });
    log.append({ type: "agent:llm-call", payload: { model: "mock" }, sessionId: "s1", workspaceHash: "ws1" });

    const stored = log.getBySession("s1");
    expect(stored.map((event) => event.seq)).toEqual([0, 1, 2]);
    expect(stored[0].type).toBe("harness:ingress");
    expect(stored[2].payload).toEqual({ model: "mock" });
    expect(log.countBySession("s1")).toBe(3);
  });

  it("does not duplicate the workspace or session on repeated ensures", () => {
    log.ensureWorkspace("ws2", "/tmp/ws2");
    log.ensureWorkspace("ws2", "/tmp/ws2");
    log.ensureSession("s2", "ws2");
    log.ensureSession("s2", "ws2");
    expect((db.select().from(workspaces).all() as Row[]).length).toBe(1);
    expect((db.select().from(sessions).all() as Row[]).length).toBe(1);
    expect((db.select().from(events).all() as Row[]).length).toBe(0);
  });

  it("replay and timeTravel are deterministic and bounds-checked", () => {
    for (let index = 0; index < 4; index++) {
      log.append({ type: "message", payload: { index }, sessionId: "s3", workspaceHash: "ws3" });
    }
    expect(log.replay("s3").map((event) => event.payload)).toEqual([{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }]);

    const sliced = log.timeTravel("s3", 1);
    expect(sliced).toHaveLength(2);
    expect(sliced[1].payload).toEqual({ index: 1 });
    expect(() => log.timeTravel("s3", 9)).toThrow(/out of bounds/);
    expect(() => log.timeTravel("s3", -1)).toThrow(/out of bounds/);
  });

  it("honours a caller-supplied id and ts and filters by workspace with a limit", () => {
    const appended = log.append({
      id: "fixed-id",
      ts: 1234,
      type: "harness:gate",
      payload: { verdict: "pass" },
      sessionId: "s4",
      workspaceHash: "ws4",
    });
    expect(appended.id).toBe("fixed-id");
    expect(appended.ts).toBe(1234);

    log.append({ type: "message", payload: {}, sessionId: "s4", workspaceHash: "ws4" });
    const byWorkspace = log.getByWorkspace("ws4", 1);
    expect(byWorkspace).toHaveLength(1);
    expect(byWorkspace[0].id).toBe("fixed-id");
  });

  it("clearSession removes only the targeted session", () => {
    log.append({ type: "message", payload: { a: 1 }, sessionId: "s5a", workspaceHash: "ws5" });
    log.append({ type: "message", payload: { b: 1 }, sessionId: "s5b", workspaceHash: "ws5" });
    log.clearSession("s5a");
    expect(log.getBySession("s5a")).toHaveLength(0);
    expect(log.getBySession("s5b")).toHaveLength(1);
  });
});
