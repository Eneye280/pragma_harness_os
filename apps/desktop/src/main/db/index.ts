import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { join } from "path";
import { createRequire } from "module";
import { existsSync, mkdirSync } from "fs";
import * as schema from "./schema";

let dbInstance: BetterSQLite3Database<typeof schema> | null = null;
let rawInstance: Database.Database | null = null;

function getDbPath(): string {
  try {
    const req = createRequire(import.meta.url);
    const electron = req("electron");
    const userData = electron.app.getPath("userData");
    const dbDir = join(userData, "pragma-harness");
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    return join(dbDir, "harness.db");
  } catch {
    return join(process.cwd(), "harness.db");
  }
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) return dbInstance;
  const dbPath = getDbPath();
  rawInstance = new Database(dbPath);
  rawInstance.pragma("journal_mode = WAL");
  rawInstance.pragma("foreign_keys = ON");
  dbInstance = drizzle(rawInstance, { schema });
  ensureTables(rawInstance);
  return dbInstance;
}

export function getMemoryDb(): BetterSQLite3Database<typeof schema> {
  const raw = new Database(":memory:");
  raw.pragma("foreign_keys = ON");
  const db = drizzle(raw, { schema });
  ensureTables(raw);
  return db;
}

function ensureTables(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_hash TEXT NOT NULL REFERENCES workspaces(hash),
      created_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      workspace_hash TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts INTEGER NOT NULL,
      seq INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id);
    CREATE INDEX IF NOT EXISTS events_workspace_idx ON events(workspace_hash);
    CREATE INDEX IF NOT EXISTS events_type_idx ON events(type);
    CREATE INDEX IF NOT EXISTS events_ts_idx ON events(ts);
  `);
}

export function closeDb(): void {
  if (rawInstance) {
    rawInstance.close();
    rawInstance = null;
    dbInstance = null;
  }
}
