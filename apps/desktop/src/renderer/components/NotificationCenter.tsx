import type { AppNotification, NotificationKind } from "@shared/notifications";
import { cn } from "../lib/cn";

interface NotificationCenterProps {
  toasts: AppNotification[];
  notifications: AppNotification[];
  open: boolean;
  onClose: () => void;
  onMarkAll: () => void;
  onMarkOne: (id: string) => void;
  onDismiss: (id: string) => void;
}

const TONE_BORDER: Record<NotificationKind, string> = {
  info: "border-l-harness",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
};

const TONE_TEXT: Record<NotificationKind, string> = {
  info: "text-harness-soft",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error: "text-red-300",
};

const ICON: Record<NotificationKind, string> = { info: "i", success: "✓", warning: "!", error: "✕" };

function timeLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationCenter({ toasts, notifications, open, onClose, onMarkAll, onMarkOne, onDismiss }: NotificationCenterProps): React.ReactElement {
  const unread = notifications.filter((entry) => !entry.read);
  const read = notifications.filter((entry) => entry.read);

  return (
    <>
      {/* Toasts flotantes con margen */}
      <div className="layer-toast pointer-events-none bottom-4 right-4 flex w-[360px] flex-col gap-2" aria-live="polite">
        {toasts.map((notification) => (
          <div
            key={notification.id}
            role={notification.kind === "error" ? "alert" : "status"}
            className={cn("overlay-surface fade-in pointer-events-auto flex items-start gap-2.5 border-l-2 px-3.5 py-2.5", TONE_BORDER[notification.kind])}
          >
            <span aria-hidden="true" className={cn("mt-0.5 font-mono text-[12px]", TONE_TEXT[notification.kind])}>
              {ICON[notification.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-zinc-100">{notification.title}</p>
              {notification.message ? <p className="mt-0.5 text-[12px] leading-snug text-zinc-400">{notification.message}</p> : null}
            </div>
            <button
              type="button"
              aria-label={`Cerrar ${notification.title}`}
              onClick={() => onDismiss(notification.id)}
              className="shrink-0 rounded-control px-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Centro: popup flotante con margen, mismo lenguaje que el palette */}
      {open ? (
        <div className="layer-overlay bg-black/40 backdrop-blur-sm" onMouseDown={onClose} role="presentation">
          <div
            className="overlay-surface palette-anim absolute right-4 top-14 flex max-h-[72vh] w-[400px] flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
              <span className="text-[14px] font-semibold text-zinc-100">Notificaciones</span>
              {unread.length > 0 ? <span className="rounded-pill bg-harness/20 px-2 py-0.5 text-[12px] text-harness-soft">{unread.length}</span> : null}
              <button
                type="button"
                onClick={onMarkAll}
                className="ml-auto rounded-control border border-hairline px-2.5 py-1 text-[12px] text-zinc-300 transition-colors hover:text-zinc-100"
              >
                Marcar todas
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar notificaciones"
                className="rounded-control px-1.5 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {notifications.length === 0 ? (
                <p className="px-2 py-8 text-center text-[13px] text-zinc-500">Sin notificaciones por ahora.</p>
              ) : (
                <div className="space-y-3">
                  <NotificationGroup title="No leídas" items={unread} onMarkOne={onMarkOne} />
                  <NotificationGroup title="Leídas" items={read} onMarkOne={onMarkOne} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function NotificationGroup({ title, items, onMarkOne }: { title: string; items: AppNotification[]; onMarkOne: (id: string) => void }): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section>
      <p className="mb-1.5 px-1 text-[12px] font-medium text-zinc-500">{title}</p>
      <ul role="list" className="space-y-1.5">
        {items.map((notification) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => onMarkOne(notification.id)}
              className={cn(
                "w-full rounded-panel border border-l-2 px-3 py-2 text-left transition-colors hover:bg-surface-raised/60",
                TONE_BORDER[notification.kind],
                notification.read ? "border-hairline bg-surface/50" : "border-hairline bg-surface-raised/40",
              )}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className={cn("font-mono text-[12px]", TONE_TEXT[notification.kind])}>
                  {ICON[notification.kind]}
                </span>
                <span className="text-[13px] text-zinc-100">{notification.title}</span>
                <span className="ml-auto shrink-0 text-[12px] text-zinc-500">{timeLabel(notification.ts)}</span>
              </span>
              {notification.message ? <span className="mt-1 block text-[12px] leading-snug text-zinc-400">{notification.message}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
