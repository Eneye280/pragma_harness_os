import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStreamEvent } from "@shared/chat-events";
import type { CostSnapshot } from "@shared/cost";
import {
  createNotification,
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
  const runStart = useRef<Map<string, { prompt: string; startedAt: number; tools: number; failures: number }>>(new Map());

  const notify = useCallback((kind: NotificationKind, title: string, message?: string, source = "app") => {
    setNotifications((current) => pushNotification(current, createNotification({ kind, title, message, source })));
  }, []);

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) return;
    const offChat = bridge.onChatEvent((event: ChatStreamEvent) => {
      const sessionId = "sessionId" in event ? event.sessionId : "default";
      if (event.kind === "error") {
        setNotifications((current) => pushNotification(current, notificationFromChatError(event.message)));
      } else if (event.kind === "user-message" && !event.steer) {
        runStart.current.set(sessionId, { prompt: event.text, startedAt: Date.now(), tools: 0, failures: 0 });
      } else if (event.kind === "harness-step" && event.status === "blocked") {
        setNotifications((current) => pushNotification(current, notificationFromBlockedStep(event.phase, event.label, event.detail)));
      } else if (event.kind === "tool-call" && event.status === "done") {
        const run = runStart.current.get(sessionId);
        if (run) run.tools += 1;
      } else if (event.kind === "tool-call" && event.status === "error") {
        const run = runStart.current.get(sessionId);
        if (run) run.failures += 1;
        setNotifications((current) => pushNotification(current, notificationFromToolFailure(event.tool, event.summary)));
      } else if (event.kind === "assistant-done") {
        const run = runStart.current.get(sessionId);
        setNotifications((current) =>
          pushNotification(
            current,
            notificationFromRunSummary({
              prompt: run?.prompt,
              status: run && run.failures > 0 ? "blocked" : "done",
              toolCalls: run?.tools ?? 0,
              failures: run?.failures ?? 0,
              durationMs: run ? Date.now() - run.startedAt : 0,
            }),
          ),
        );
        runStart.current.delete(sessionId);
      } else if (event.kind === "tool-approval") {
        setNotifications((current) => pushNotification(current, notificationFromToolApproval(event.tool, event.summary)));
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
