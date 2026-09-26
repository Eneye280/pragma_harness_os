import type { AppNotification } from "@shared/notifications";
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

const TONE: Record<AppNotification["kind"], string> = {
  info: "border-harness/40 text-harness-soft",
  success: "border-emerald-500/40 text-emerald-300",
  warning: "border-amber-500/40 text-amber-300",
  error: "border-red-500/40 text-red-300",
};

const ICON: Record<AppNotification["kind"], string> = { info: "i", success: "✓", warning: "!", error: "✕" };

export function NotificationCenter({ toasts, notifications, open, onClose, onMarkAll, onMarkOne, onDismiss }: NotificationCenterProps): React.ReactElement {
  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2" aria-live="polite">
        {toasts.map((notification) => (
          <div key={notification.id} role={notification.kind === "error" ? "alert" : "status"} className={cn("glass pointer-events-auto flex items-start gap-2 rounded-panel px-3 py-2 fade-in", TONE[notification.kind])}>
            <span aria-hidden="true" className="mt-[1px] font-mono text-[11px]">{ICON[notification.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-zinc-100">{notification.title}</p>
              {notification.message ? <p className="truncate text-[11px] text-zinc-400">{notification.message}</p> : null}
            </div>
            <button type="button" aria-label={`Cerrar ${notification.title}`} onClick={() => onDismiss(notification.id)} className="text-[11px] text-zinc-500 hover:text-zinc-200">
              ✕
            </button>
          </div>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={onClose}>
          <aside
            className="sheet flex h-full w-[360px] flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <span className="text-label tracking-label text-harness-soft">Notificaciones</span>
              <button type="button" onClick={onMarkAll} className="ml-auto rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">
                Marcar leídas
              </button>
              <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
                Cerrar
              </button>
            </div>
            <ul role="list" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {notifications.length === 0 ? <li className="text-[11px] text-zinc-500">sin notificaciones</li> : null}
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onMarkOne(notification.id)}
                    className={cn(
                      "w-full rounded-control border px-2.5 py-2 text-left transition-colors hover:bg-zinc-800/40",
                      notification.read ? "border-hairline bg-surface/60" : "border-harness/40 bg-harness/10",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("font-mono text-[11px]", TONE[notification.kind].split(" ")[1])}>{ICON[notification.kind]}</span>
                      <span className="text-[12px] text-zinc-200">{notification.title}</span>
                      <span className="ml-auto text-[10px] text-zinc-500">{new Date(notification.ts).toLocaleTimeString()}</span>
                    </span>
                    {notification.message ? <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{notification.message}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : null}
    </>
  );
}
