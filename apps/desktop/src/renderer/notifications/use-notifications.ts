import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStreamEvent } from "@shared/chat-events";
import type { CostSnapshot } from "@shared/cost";
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
  type AppNotification,
  type NotificationKind,
} from "@shared/notifications";

export interface UseNotificationsResult {
  notifications: AppNotification[];
  toasts: AppNotification[];
  unread: number;
  notify: (kind: NotificationKind, title: string, message?: string, source?: string) => void;
  markAll: () => void;
  markOne: (id: string) => void;
  dismiss: (id: string) => void;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [, setTick] = useState(0);
  const budgetWarned = useRef(false);

  const notify = useCallback((kind: NotificationKind, title: string, message?: string, source = "app") => {
    setNotifications((current) => pushNotification(current, createNotification({ kind, title, message, source })));
  }, []);

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) return;
    const offChat = bridge.onChatEvent((event: ChatStreamEvent) => {
      if (event.kind === "error") {
        setNotifications((current) => pushNotification(current, notificationFromChatError(event.message)));
      } else if (event.kind === "harness-step" && event.status === "blocked") {
        setNotifications((current) =>
          pushNotification(current, createNotification({ kind: "warning", title: "Paso bloqueado", message: `${event.phase}: ${event.label}`, source: "harness" }))
        );
      } else if (event.kind === "assistant-done") {
        setNotifications((current) =>
          pushNotification(current, createNotification({ kind: "success", title: "Run terminado", source: "chat" }))
        );
      } else if (event.kind === "tool-approval") {
        setNotifications((current) =>
          pushNotification(current, createNotification({ kind: "info", title: "Permiso solicitado", message: `${event.tool}: ${event.summary}`, source: "tools" }))
        );
      }
    });
    const offCost = bridge.cost?.onUpdated((snapshot: CostSnapshot) => {
      const warning = notificationFromBudget(snapshot.today.tokens, snapshot.budget.tokensPerDay, snapshot.today.usd, snapshot.budget.usdPerDay);
      if (warning && !budgetWarned.current) {
        budgetWarned.current = true;
        setNotifications((current) => pushNotification(current, warning));
      }
    });
    return () => {
      offChat?.();
      offCost?.();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    toasts: visibleToasts(notifications),
    unread: unreadCount(notifications),
    notify,
    markAll: () => setNotifications((current) => markAllRead(current)),
    markOne: (id) => setNotifications((current) => markRead(current, id)),
    dismiss: (id) => setNotifications((current) => removeNotification(current, id)),
  };
}
