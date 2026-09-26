import { describe, it, expect } from "vitest";
import type { SessionSummary } from "@shared/session";
import { filterSessions, formatRelativeTime } from "../session-utils";
import { resolveShellShortcut } from "../shortcuts";
import { INITIAL_PANEL_STATE, actionForShortcut, panelReducer } from "../panel-state";

function session(id: string, title: string): SessionSummary {
  return { id, title, workspacePath: "/ws", workspaceHash: "h", createdAt: 0, updatedAt: 0, messageCount: 2 };
}

describe("session utils", () => {
  it("filters by title case-insensitively", () => {
    const sessions = [session("1", "Login flow"), session("2", "Unity inventory")];
    expect(filterSessions(sessions, "unity").map((entry) => entry.id)).toEqual(["2"]);
    expect(filterSessions(sessions, "").length).toBe(2);
    expect(filterSessions(sessions, "zzz")).toEqual([]);
  });

  it("formats relative time", () => {
    const now = 1_000_000_000_000;
    expect(formatRelativeTime(now - 30_000, now)).toBe("ahora");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 min");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3 h");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2 d");
  });
});

describe("session history shortcut + panel", () => {
  it("maps Ctrl/Cmd+Shift+H to session-history", () => {
    expect(resolveShellShortcut({ key: "h", ctrlKey: true, shiftKey: true })).toBe("session-history");
    expect(resolveShellShortcut({ key: "H", metaKey: true, shiftKey: true })).toBe("session-history");
    expect(resolveShellShortcut({ key: "h", ctrlKey: true })).toBeNull();
  });

  it("toggles the sessions panel", () => {
    const opened = panelReducer(INITIAL_PANEL_STATE, actionForShortcut("session-history"));
    expect(opened.sessionsOpen).toBe(true);
    const closed = panelReducer(opened, actionForShortcut("session-history"));
    expect(closed.sessionsOpen).toBe(false);
  });
});
