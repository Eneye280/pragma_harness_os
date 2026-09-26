import { useState } from "react";
import type { CostSnapshot } from "@shared/cost";
import type { GitStatus } from "@shared/git";
import { cn } from "../lib/cn";
import { Menu } from "../ui/Menu";
import { IconCommand, IconMinimize, IconMaximize, IconClose } from "./icons";

interface TitleBarProps {
  status: string;
  cost: CostSnapshot | null;
  git: GitStatus | null;
  workspaceName: string;
  projectPath?: string;
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
  projectPath,
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
  const hasProject = Boolean(projectPath);

  async function handleMaximize(): Promise<void> {
    if (!controls) return;
    setIsMaximized(await controls.maximizeOrRestore());
  }

  return (
    <header
      className="draggable relative flex shrink-0 items-center gap-2 border-b border-hairline px-3"
      style={{ height: "var(--phs-titlebar-height)", zIndex: "var(--phs-z-header)" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-harness" style={{ boxShadow: "var(--phs-shadow-glow)" }} aria-hidden="true" />
        <span className="shrink-0 text-title tracking-tight text-zinc-100">Pragma Harness OS</span>

        <span className="hidden h-4 w-px shrink-0 bg-hairline sm:block" aria-hidden="true" />

        <span
          title={projectPath ?? "Sin proyecto abierto"}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px]",
            hasProject ? "border-hairline bg-surface-raised/70 text-zinc-200" : "border-dashed border-hairline text-zinc-500",
          )}
        >
          <span aria-hidden="true" className={hasProject ? "text-harness-soft" : "text-zinc-600"}>
            ▸
          </span>
          <span className="truncate">{hasProject ? workspaceName : "sin proyecto"}</span>
        </span>

        {git?.isRepo ? (
          <span
            aria-label={`Rama ${git.detached ? "detached" : git.branch}${git.dirty ? `, ${git.changedCount} cambios sin commitear` : ", limpia"}`}
            title={`${git.branch ?? "HEAD"}${git.dirty ? ` · ${git.changedCount} cambios` : ""}`}
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-pill border px-2 py-1 font-mono text-[12px] lg:flex",
              git.dirty ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-hairline bg-surface-raised/70 text-zinc-400",
            )}
          >
            <span aria-hidden="true">⑂</span>
            <span className="max-w-[140px] truncate">{git.detached ? "detached" : git.branch}</span>
            {git.ahead > 0 ? <span aria-hidden="true">↑{git.ahead}</span> : null}
            {git.behind > 0 ? <span aria-hidden="true">↓{git.behind}</span> : null}
          </span>
        ) : null}
      </div>

      <div className="no-drag ml-auto flex items-center gap-1.5">
        <span
          className={cn("hidden items-center gap-1.5 rounded-pill border px-2 py-1 text-[12px] md:flex", healthy ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}
          title={status}
        >
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", healthy ? "bg-emerald-400" : "bg-amber-400")} />
          {healthy ? "conectado" : status}
        </span>

        {cost ? (
          <span
            title={`${cost.today.tokens.toLocaleString()} tokens hoy · ${cost.today.calls} llamadas`}
            className={cn(
              "hidden rounded-pill border px-2 py-1 font-mono text-[12px] md:inline",
              cost.today.usd >= cost.budget.usdPerDay ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-hairline bg-surface-raised/70 text-zinc-400",
            )}
          >
            ${cost.today.usd.toFixed(2)}
          </span>
        ) : null}

        <button
          type="button"
          aria-label="Command palette (Ctrl/Cmd+K)"
          title="Command palette · Ctrl/Cmd+K"
          onClick={onOpenPalette}
          className="flex h-8 items-center gap-1.5 rounded-control border border-hairline bg-surface-raised/50 px-2.5 text-zinc-400 outline-none transition-colors hover:border-harness/40 hover:text-zinc-100"
        >
          <IconCommand width={14} height={14} />
          <span className="hidden font-mono text-[12px] text-zinc-500 xl:inline">⌘K</span>
        </button>

        <Menu
          label="Más"
          trigger={<span aria-hidden="true">⋯</span>}
          header="Paneles y vistas"
          items={[
            {
              label: "Paneles",
              items: [
                { id: "explorer", label: "Explorer", hint: "⌘B", onSelect: onToggleExplorer },
                { id: "context", label: "Context", hint: "⇧⌘C", onSelect: onToggleContext },
                { id: "terminal", label: "Terminal", hint: "⌘`", onSelect: onToggleTerminal },
              ],
            },
            {
              label: "Proyecto",
              items: [
                { id: "sessions", label: "Sesiones y proyectos", hint: "⇧⌘H", onSelect: onOpenSessions },
                { id: "graph", label: "Grafo de dependencias", onSelect: onOpenGraph },
                { id: "usage", label: "Uso y coste", onSelect: onOpenUsage },
                { id: "health", label: "Diagnóstico / health", onSelect: onOpenDiagnostics },
                { id: "help", label: "Centro de ayuda", onSelect: onOpenHelp },
              ],
            },
            {
              label: "Aplicación",
              items: [{ id: "settings", label: "Settings", hint: "⌘,", onSelect: onOpenSettings }],
            },
          ]}
        />

        <button
          type="button"
          aria-label={`Notificaciones (${unreadNotifications})`}
          title={`Notificaciones (${unreadNotifications})`}
          onClick={onOpenNotifications}
          className="relative flex h-8 w-8 items-center justify-center rounded-control text-zinc-400 outline-none transition-colors hover:bg-surface-raised hover:text-zinc-100"
        >
          <span aria-hidden="true">◔</span>
          {unreadNotifications > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 rounded-pill bg-harness px-1 text-[12px] font-semibold text-white">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          aria-label="Settings (Ctrl/Cmd+,)"
          title="Settings · Ctrl/Cmd+," 
          onClick={onOpenSettings}
          className="flex h-8 w-8 items-center justify-center rounded-control text-zinc-400 outline-none transition-colors hover:bg-surface-raised hover:text-zinc-100"
        >
          <span aria-hidden="true">⚙</span>
        </button>

        <div className="mx-0.5 h-4 w-px bg-hairline" aria-hidden="true" />
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
        danger ? "hover:bg-red-500/90 hover:text-white" : "hover:bg-surface-raised hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}
