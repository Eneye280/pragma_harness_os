import { useState } from "react";
import { layout } from "ui-tokens";
import { cn } from "../lib/cn";
import { IconCommand, IconClose, IconMaximize, IconMinimize } from "./icons";

interface TitleBarProps {
  status: string;
  onOpenPalette: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
}

export function TitleBar({ status, onOpenPalette, onToggleExplorer, onToggleContext }: TitleBarProps): React.ReactElement {
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
        ● {status}
      </span>

      <nav className="no-drag ml-2 flex items-center gap-1">
        <TitleBarButton label="Explorer (Ctrl/Cmd+B)" onClick={onToggleExplorer}>
          <span className="text-[11px]">Explorer</span>
        </TitleBarButton>
        <TitleBarButton label="Context (Ctrl/Cmd+Shift+C)" onClick={onToggleContext}>
          <span className="text-[11px]">Context</span>
        </TitleBarButton>
      </nav>

      <span className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
        harness-first · ts
      </span>

      <nav className="no-drag flex items-center gap-1">
        <TitleBarButton label="Command palette (Ctrl/Cmd+K)" onClick={onOpenPalette}>
          <IconCommand width={14} height={14} />
          <span className="text-[11px]">Command</span>
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
