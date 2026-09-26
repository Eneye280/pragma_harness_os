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
  const currentRun = useRef<{ prompt: string; startedAt: number; tools: Map<string, string>; failures: number } | null>(null);
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ensureRun(): NonNullable<typeof currentRun.current> {
    if (!currentRun.current) currentRun.current = { prompt: "", startedAt: Date.now(), tools: new Map(), failures: 0 };
    return currentRun.current;
  }

  const notify = useCallback((kind: NotificationKind, title: string, message?: string, source = "app") => {
    setNotifications((current) => pushNotification(current, createNotification({ kind, title, message, source })));
  }, []);

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) return;
    const offChat = bridge.onChatEvent((event: ChatStreamEvent) => {
      if (event.kind === "error") {
        setNotifications((current) => pushNotification(current, notificationFromChatError(event.message)));
      } else if (event.kind === "user-message") {
        const run = ensureRun();
        if (!event.steer) run.prompt = event.text;
      } else if (event.kind === "harness-step" && event.status === "blocked") {
        setNotifications((current) => pushNotification(current, notificationFromBlockedStep(event.phase, event.label, event.detail)));
      } else if (event.kind === "tool-call") {
        const run = ensureRun();
        run.tools.set(event.callId, event.tool);
      } else if (event.kind === "tool-observation") {
        const run = ensureRun();
        if (!run.tools.has(event.callId)) run.tools.set(event.callId, "tool");
        if (!event.ok) {
          run.failures += 1;
          setNotifications((current) => pushNotification(current, notificationFromToolFailure(run.tools.get(event.callId) ?? "tool", event.output.slice(0, 140))));
        }
      } else if (event.kind === "harness-step") {
        ensureRun();
      } else if (event.kind === "assistant-done") {
        // El turno termina antes de que corran sus tools: esperamos a que se asienten.
        if (summaryTimer.current) clearTimeout(summaryTimer.current);
        summaryTimer.current = setTimeout(() => {
          const run = currentRun.current;
          setNotifications((current) =>
            pushNotification(
              current,
              notificationFromRunSummary({
                prompt: run?.prompt || undefined,
                status: run && run.failures > 0 ? "blocked" : "done",
                toolCalls: run?.tools.size ?? 0,
                failures: run?.failures ?? 0,
                durationMs: run ? Date.now() - run.startedAt : 0,
              }),
            ),
          );
          currentRun.current = null;
        }, 1500);
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
