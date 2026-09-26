import { useState } from "react";
import { layout } from "ui-tokens";
import type { CostSnapshot } from "@shared/cost";
import type { GitStatus } from "@shared/git";
import { cn } from "../lib/cn";
import { IconCommand, IconClose, IconMaximize, IconMinimize } from "./icons";

interface TitleBarProps {
  status: string;
  cost: CostSnapshot | null;
  git: GitStatus | null;
  onOpenPalette: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
}

export function TitleBar({
  status,
  cost,
  git,
  onOpenPalette,
  onToggleExplorer,
  onToggleContext,
  onToggleTerminal,
  onOpenSettings,
  onOpenSessions,
}: TitleBarProps): React.ReactElement {
  const [isMaximized, setIsMaximized] = useState(false);

  const controls = window.harness?.windowControls;

  async function handleMaximize(): Promise<void> {
    if (!controls) return;
    setIsMaximized(await controls.maximizeOrRestore());
  }

  return (
    <header
      className="draggable flex shrink-0 items-center gap-3 border-b border-hairline bg-surface-raised/80 px-3 backdrop-blur"
      style={{ height: layout.titleBarHeight }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-harness shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-100">Pragma Harness OS</span>
      </div>

      <span className="rounded-full border border-harness/40 bg-harness/10 px-2 py-[3px] text-[10px] font-medium text-harness-soft">
        <span aria-hidden="true">● </span>
        {status}
      </span>

      <nav className="no-drag ml-2 flex items-center gap-1">
        <TitleBarButton label="Explorer (Ctrl/Cmd+B)" onClick={onToggleExplorer}>
          <span className="text-[11px]">Explorer</span>
        </TitleBarButton>
        <TitleBarButton label="Context (Ctrl/Cmd+Shift+C)" onClick={onToggleContext}>
          <span className="text-[11px]">Context</span>
        </TitleBarButton>
        <TitleBarButton label="Terminal (Ctrl/Cmd+`)" onClick={onToggleTerminal}>
          <span className="text-[11px]">Terminal</span>
        </TitleBarButton>
      </nav>

      <span className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
        harness-first · ts
      </span>

      {git?.isRepo ? (
        <span
          aria-label={`Rama ${git.detached ? "detached" : git.branch}${git.dirty ? `, ${git.changedCount} cambios sin commitear` : ", limpia"}`}
          title={`${git.branch ?? "HEAD"}${git.dirty ? ` · ${git.changedCount} cambios` : ""}`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[10px]",
            git.dirty ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-hairline bg-surface-raised text-zinc-400",
          )}
        >
          <span aria-hidden="true">⑂</span>
          {git.detached ? "detached" : git.branch}
          {git.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" /> : null}
          {git.ahead > 0 ? <span aria-hidden="true">↑{git.ahead}</span> : null}
          {git.behind > 0 ? <span aria-hidden="true">↓{git.behind}</span> : null}
        </span>
      ) : null}

      {cost ? (
        <span
          title={`${cost.today.tokens.toLocaleString()} tokens hoy · ${cost.today.calls} llamadas\npor dominio: ${
            cost.perDomain.map((domain) => `${domain.domain}:${domain.tokens}`).join(", ") || "—"
          }`}
          className={cn(
            "rounded-full border px-2 py-[3px] font-mono text-[10px]",
            cost.today.usd >= cost.budget.usdPerDay
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-hairline bg-surface-raised text-zinc-400",
          )}
        >
          ${cost.today.usd.toFixed(2)} / ${cost.budget.usdPerDay.toFixed(2)}
        </span>
      ) : null}

      <nav className="no-drag flex items-center gap-1">
        <TitleBarButton label="Command palette (Ctrl/Cmd+K)" onClick={onOpenPalette}>
          <IconCommand width={14} height={14} />
          <span className="text-[11px]">Command</span>
        </TitleBarButton>
        <TitleBarButton label="Sesiones (Ctrl/Cmd+Shift+H)" onClick={onOpenSessions}>
          <span className="text-[11px]">Sessions</span>
        </TitleBarButton>
        <TitleBarButton label="Settings (Ctrl/Cmd+,)" onClick={onOpenSettings}>
          <span className="text-[11px]">Settings</span>
        </TitleBarButton>
        <div className="mx-1 h-4 w-px bg-hairline" />
        <WindowButton label="Minimize" onClick={() => controls?.minimize()}>
          <IconMinimize width={14} height={14} />
        </WindowButton>
        <WindowButton label={isMaximized ? "Restore" : "Maximize"} onClick={handleMaximize}>
          <IconMaximize width={13} height={13} />
        </WindowButton>
        <WindowButton label="Close" danger onClick={() => controls?.close()}>
          <IconClose width={14} height={14} />
        </WindowButton>
      </nav>
    </header>
  );
}

function TitleBarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-control px-2 py-1 text-zinc-400 outline-none transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-harness"
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
