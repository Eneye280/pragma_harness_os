import { useState } from "react";
import { layout } from "ui-tokens";
import type { CostSnapshot } from "@shared/cost";
import type { GitStatus } from "@shared/git";
import { cn } from "../lib/cn";
import { Menu } from "../ui/Menu";
import { IconCommand, IconClose, IconMaximize, IconMinimize } from "./icons";

interface TitleBarProps {
  status: string;
  cost: CostSnapshot | null;
  git: GitStatus | null;
  workspaceName: string;
  onOpenPalette: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onOpenGraph: () => void;
  onOpenHelp: () => void;
  onOpenUsage: () => void;
  onOpenDiagnostics: () => void;
  unreadNotifications: number;
  onOpenNotifications: () => void;
}

export function TitleBar({
  status,
  cost,
  git,
  workspaceName,
  onOpenPalette,
  onToggleExplorer,
  onToggleContext,
  onToggleTerminal,
  onOpenSettings,
  onOpenSessions,
  onOpenGraph,
  onOpenHelp,
  onOpenUsage,
  onOpenDiagnostics,
  unreadNotifications,
  onOpenNotifications,
}: TitleBarProps): React.ReactElement {
  const [isMaximized, setIsMaximized] = useState(false);
  const controls = window.harness?.windowControls;
  const healthy = status.includes("ready") || status.includes("ok");

  async function handleMaximize(): Promise<void> {
    if (!controls) return;
    setIsMaximized(await controls.maximizeOrRestore());
  }

  return (
    <header
      className="draggable floating-toolbar flex shrink-0 items-center gap-2 px-3"
      style={{ height: layout.titleBarHeight }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-harness shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        <span className="truncate text-title tracking-tight text-zinc-100" title={workspaceName}>
          {workspaceName || "Pragma Harness OS"}
        </span>
        <span className="hidden shrink-0 text-[10px] tracking-label text-zinc-500 sm:inline">PRAGMA HARNESS OS</span>
      </div>

      {git?.isRepo ? (
        <span
          aria-label={`Rama ${git.detached ? "detached" : git.branch}${git.dirty ? `, ${git.changedCount} cambios sin commitear` : ", limpia"}`}
          title={`${git.branch ?? "HEAD"}${git.dirty ? ` · ${git.changedCount} cambios` : ""}`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-[3px] font-mono text-[10px]",
            git.dirty ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-hairline bg-surface-raised/70 text-zinc-400",
          )}
        >
          <span aria-hidden="true">⑂</span>
          <span className="max-w-[140px] truncate">{git.detached ? "detached" : git.branch}</span>
          {git.dirty ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
          {git.ahead > 0 ? <span aria-hidden="true">↑{git.ahead}</span> : null}
          {git.behind > 0 ? <span aria-hidden="true">↓{git.behind}</span> : null}
        </span>
      ) : null}

      <div className="no-drag ml-auto flex items-center gap-1.5">
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-pill border px-2 py-[3px] text-[10px] font-medium md:flex",
            healthy ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300",
          )}
          title={status}
        >
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", healthy ? "bg-emerald-400" : "bg-amber-400")} />
          {healthy ? "conectado" : status}
        </span>

        {cost ? (
          <span
            title={`${cost.today.tokens.toLocaleString()} tokens hoy · ${cost.today.calls} llamadas`}
            className={cn(
              "hidden rounded-pill border px-2 py-[3px] font-mono text-[10px] md:inline",
              cost.today.usd >= cost.budget.usdPerDay ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-hairline bg-surface-raised/70 text-zinc-400",
            )}
          >
            ${cost.today.usd.toFixed(2)} / ${cost.budget.usdPerDay.toFixed(2)}
          </span>
        ) : null}

        <div className="hidden items-center gap-0.5 rounded-pill border border-hairline bg-surface-raised/50 p-0.5 sm:flex" role="group" aria-label="Paneles">
          <IconToggle label="Explorer (Ctrl/Cmd+B)" onClick={onToggleExplorer}>▤</IconToggle>
          <IconToggle label="Context (Ctrl/Cmd+Shift+C)" onClick={onToggleContext}>◫</IconToggle>
          <IconToggle label="Terminal (Ctrl/Cmd+`)" onClick={onToggleTerminal}>▭</IconToggle>
        </div>

        <IconButton label="Command palette (Ctrl/Cmd+K)" onClick={onOpenPalette}>
          <IconCommand width={14} height={14} />
        </IconButton>

        <Menu
          label="Más"
          trigger={<span aria-hidden="true">⋯</span>}
          items={[
            { id: "sessions", label: "Sesiones", hint: "⇧⌘H", onSelect: onOpenSessions },
            { id: "graph", label: "Grafo de dependencias", onSelect: onOpenGraph },
            { id: "usage", label: "Uso y coste", onSelect: onOpenUsage },
            { id: "health", label: "Diagnóstico / health", onSelect: onOpenDiagnostics },
            { id: "help", label: "Centro de ayuda", onSelect: onOpenHelp },
          ]}
        />

        <IconButton label={`Notificaciones (${unreadNotifications})`} onClick={onOpenNotifications}>
          <span className="relative">
            ◔
            {unreadNotifications > 0 ? (
              <span className="absolute -right-2 -top-1.5 rounded-pill bg-harness px-1 text-[9px] font-semibold text-white">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
            ) : null}
          </span>
        </IconButton>

        <IconButton label="Settings (Ctrl/Cmd+,)" onClick={onOpenSettings}>
          <span aria-hidden="true">⚙</span>
        </IconButton>

        <div className="mx-0.5 h-4 w-px bg-hairline" />
        <WindowButton label="Minimize" onClick={() => controls?.minimize()}>
          <IconMinimize width={14} height={14} />
        </WindowButton>
        <WindowButton label={isMaximized ? "Restore" : "Maximize"} onClick={handleMaximize}>
          <IconMaximize width={13} height={13} />
        </WindowButton>
        <WindowButton label="Close" danger onClick={() => controls?.close()}>
          <IconClose width={14} height={14} />
        </WindowButton>
      </div>
    </header>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-8 items-center justify-center rounded-control text-zinc-400 outline-none transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-harness"
    >
      {children}
    </button>
  );
}

function IconToggle({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-7 items-center justify-center rounded-pill text-[11px] text-zinc-400 outline-none transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-harness"
    >
      {children}
    </button>
  );
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-9 items-center justify-center rounded-control text-zinc-400 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-harness",
        danger ? "hover:bg-red-500/90 hover:text-white" : "hover:bg-zinc-700 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}
