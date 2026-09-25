import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  hash: text("hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  workspaceHash: text("workspace_hash").notNull().references(() => workspaces.hash),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => sessions.id),
    workspaceHash: text("workspace_hash").notNull(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    ts: integer("ts").notNull(),
    seq: integer("seq").notNull(),
  },
  (table) => [
    index("events_session_idx").on(table.sessionId),
    index("events_workspace_idx").on(table.workspaceHash),
    index("events_type_idx").on(table.type),
    index("events_ts_idx").on(table.ts),
  ]
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
