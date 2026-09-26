import { describe, expect, it } from "vitest";
import {
  createNotification,
  markAllRead,
  markRead,
  notificationFromBudget,
  notificationFromChatError,
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

  it("keeps sticky toasts and expires transient ones", () => {
    const now = 1_000_000;
    const transient = createNotification({ kind: "success", title: "ok", source: "app", ts: now - 10_000 });
    const sticky = createNotification({ kind: "error", title: "boom", source: "chat", ts: now - 60_000 });
    expect(visibleToasts([transient, sticky], now)).toEqual([sticky]);
  });

  it("builds budget and chat error notifications", () => {
    expect(notificationFromBudget(200, 100, 0, 5)?.kind).toBe("warning");
    expect(notificationFromBudget(10, 100, 6, 5)?.kind).toBe("warning");
    expect(notificationFromBudget(10, 100, 1, 5)).toBeNull();
    expect(notificationFromChatError("provider caído").message).toBe("provider caído");
  });
});
