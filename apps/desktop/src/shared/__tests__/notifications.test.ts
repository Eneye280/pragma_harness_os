import { describe, expect, it } from "vitest";
import {
  createNotification,
  formatDuration,
  markAllRead,
  markRead,
  notificationFromBlockedStep,
  notificationFromBudget,
  notificationFromChatError,
  notificationFromRunSummary,
  notificationFromToolApproval,
  notificationFromToolFailure,
  pushNotification,
  removeNotification,
  unreadCount,
  visibleToasts,
} from "../notifications";

describe("notifications", () => {
  it("creates notifications and marks errors/warnings sticky", () => {
    expect(createNotification({ kind: "info", title: "hola", source: "app" }).sticky).toBe(false);
    expect(createNotification({ kind: "error", title: "boom", source: "chat" }).sticky).toBe(true);
    expect(createNotification({ kind: "warning", title: "ojo", source: "budget" }).sticky).toBe(true);
  });

  it("pushes newest first and caps the list", () => {
    let list = [] as ReturnType<typeof createNotification>[];
    for (let index = 0; index < 105; index++) list = pushNotification(list, createNotification({ kind: "info", title: `n${index}`, source: "app" }));
    expect(list).toHaveLength(100);
    expect(list[0].title).toBe("n104");
  });

  it("tracks unread and marks read", () => {
    const a = createNotification({ kind: "info", title: "a", source: "app", id: "a" });
    const b = createNotification({ kind: "error", title: "b", source: "app", id: "b" });
    let list = pushNotification(pushNotification([], a), b);
    expect(unreadCount(list)).toBe(2);
    list = markRead(list, "a");
    expect(unreadCount(list)).toBe(1);
    list = markAllRead(list);
    expect(unreadCount(list)).toBe(0);
    list = removeNotification(list, "b");
    expect(list).toHaveLength(1);
  });

  it("expires every toast, giving sticky warnings a longer life", () => {
    const now = 1_000_000;
    const transient = createNotification({ kind: "success", title: "ok", source: "app", ts: now - 10_000 });
    const stickyFresh = createNotification({ kind: "error", title: "boom", source: "chat", ts: now - 9_000 });
    expect(visibleToasts([transient, stickyFresh], now)).toEqual([stickyFresh]);

    // A los 11s el aviso pegajoso también se cerró solo.
    const stickyOld = createNotification({ kind: "warning", title: "ojo", source: "budget", ts: now - 11_000 });
    expect(visibleToasts([stickyOld], now)).toEqual([]);
    expect(visibleToasts([transient], now)).toEqual([]);
  });

  it("builds budget and chat error notifications", () => {
    expect(notificationFromBudget(200, 100, 0, 5)?.kind).toBe("warning");
    expect(notificationFromBudget(10, 100, 6, 5)?.kind).toBe("warning");
    expect(notificationFromBudget(10, 100, 1, 5)).toBeNull();
    expect(notificationFromChatError("provider caído").message).toBe("provider caído");
  });

  it("formats durations across scales", () => {
    expect(formatDuration(320)).toBe("320ms");
    expect(formatDuration(4200)).toBe("4.2s");
    expect(formatDuration(65_000)).toBe("1m 5s");
  });

  it("writes real run messages with prompt, tools, failures and time", () => {
    const ok = notificationFromRunSummary({ prompt: "crea un endpoint /users para el backend", status: "done", toolCalls: 3, failures: 0, durationMs: 4200 });
    expect(ok.kind).toBe("success");
    expect(ok.message).toContain("3 tools");
    expect(ok.message).toContain("4.2s");
    expect(ok.message).toContain("/users");

    const bad = notificationFromRunSummary({ status: "blocked", toolCalls: 2, failures: 1, durationMs: 1500 });
    expect(bad.kind).toBe("warning");
    expect(bad.message).toContain("1 fallo");
  });

  it("builds tool and step notifications with the real detail", () => {
    expect(notificationFromToolFailure("runTests", "3 tests fallaron").kind).toBe("error");
    expect(notificationFromToolFailure("runTests", "3 tests fallaron").message).toBe("3 tests fallaron");
    expect(notificationFromBlockedStep("pre-gates", "budget", "tokens 120/100").message).toBe("tokens 120/100");
    expect(notificationFromToolApproval("fileEdit", "crear harness-note.md").title).toContain("fileEdit");
  });
});
