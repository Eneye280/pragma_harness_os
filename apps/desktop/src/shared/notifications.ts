export type NotificationKind = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  source: string;
  ts: number;
  read: boolean;
  sticky?: boolean;
}

const MAX_NOTIFICATIONS = 100;

export function createNotification(input: {
  kind: NotificationKind;
  title: string;
  message?: string;
  source: string;
  ts?: number;
  id?: string;
}): AppNotification {
  return {
    id: input.id ?? `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    title: input.title,
    message: input.message,
    source: input.source,
    ts: input.ts ?? Date.now(),
    read: false,
    sticky: input.kind === "error" || input.kind === "warning",
  };
}

export function pushNotification(list: AppNotification[], notification: AppNotification): AppNotification[] {
  return [notification, ...list].slice(0, MAX_NOTIFICATIONS);
}

export function markRead(list: AppNotification[], id: string): AppNotification[] {
  return list.map((entry) => (entry.id === id ? { ...entry, read: true } : entry));
}

export function markAllRead(list: AppNotification[]): AppNotification[] {
  return list.map((entry) => (entry.read ? entry : { ...entry, read: true }));
}

export function removeNotification(list: AppNotification[], id: string): AppNotification[] {
  return list.filter((entry) => entry.id !== id);
}

export function unreadCount(list: AppNotification[]): number {
  return list.filter((entry) => !entry.read).length;
}

export function visibleToasts(list: AppNotification[], now = Date.now(), ttlMs = 6000): AppNotification[] {
  return list.filter((entry) => entry.sticky || now - entry.ts < ttlMs).slice(0, 4);
}

export function notificationFromChatError(message: string): AppNotification {
  return createNotification({ kind: "error", title: "Error del harness", message, source: "chat" });
}

export function notificationFromBudget(tokensUsed: number, tokensLimit: number, usd: number, usdLimit: number): AppNotification | null {
  if (tokensLimit > 0 && tokensUsed >= tokensLimit) {
    return createNotification({ kind: "warning", title: "Presupuesto de tokens alcanzado", message: `${tokensUsed}/${tokensLimit} tokens hoy`, source: "budget" });
  }
  if (usdLimit > 0 && usd >= usdLimit) {
    return createNotification({ kind: "warning", title: "Presupuesto de USD alcanzado", message: `$${usd.toFixed(4)}/$${usdLimit}`, source: "budget" });
  }
  return null;
}
