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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export interface RunSummaryInput {
  prompt?: string;
  status: "done" | "blocked";
  toolCalls: number;
  failures: number;
  durationMs: number;
}

/** Notificación real de un run: qué se pidió, cuántas tools, fallos y duración. */
export function notificationFromRunSummary(input: RunSummaryInput): AppNotification {
  const parts: string[] = [];
  if (input.prompt) parts.push(`“${input.prompt.trim().slice(0, 60)}${input.prompt.trim().length > 60 ? "…" : ""}”`);
  parts.push(`${input.toolCalls} tool${input.toolCalls === 1 ? "" : "s"}`);
  if (input.failures > 0) parts.push(`${input.failures} fallo${input.failures === 1 ? "" : "s"}`);
  parts.push(formatDuration(input.durationMs));
  const blocked = input.status === "blocked" || input.failures > 0;
  return createNotification({
    kind: blocked ? "warning" : "success",
    title: blocked ? "Run terminado con problemas" : "Run completado",
    message: parts.join(" · "),
    source: "chat",
  });
}

export function notificationFromToolFailure(tool: string, summary: string): AppNotification {
  return createNotification({ kind: "error", title: `Tool falló: ${tool}`, message: summary, source: "tools" });
}

export function notificationFromBlockedStep(phase: string, label: string, detail?: string): AppNotification {
  return createNotification({ kind: "warning", title: `Paso bloqueado: ${phase}`, message: detail || label, source: "harness" });
}

export function notificationFromToolApproval(tool: string, summary: string): AppNotification {
  return createNotification({ kind: "info", title: `Permiso solicitado: ${tool}`, message: summary, source: "tools" });
}
