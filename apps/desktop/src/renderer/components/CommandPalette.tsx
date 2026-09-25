import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { IconCommand, IconFolder, IconPanelLeft, IconPanelRight, IconSearch } from "./icons";

interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
}

function buildCommands(onToggleExplorer: () => void, onToggleContext: () => void): PaletteCommand[] {
  return [
    { id: "toggle-explorer", label: "Toggle Explorer", hint: "Ctrl/Cmd+B", icon: <IconPanelLeft width={14} height={14} /> },
    { id: "toggle-context", label: "Toggle Context", hint: "Ctrl/Cmd+Shift+C", icon: <IconPanelRight width={14} height={14} /> },
    { id: "open-workspace", label: "Open workspace", hint: "TASK 14/20", icon: <IconFolder width={14} height={14} /> },
    { id: "settings", label: "Open settings", hint: "TASK 22", icon: <IconCommand width={14} height={14} /> },
  ];
}

export function CommandPalette({ open, onClose, onToggleExplorer, onToggleContext }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo(() => buildCommands(onToggleExplorer, onToggleContext), [onToggleExplorer, onToggleContext]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(normalizedQuery));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex > filtered.length - 1) setActiveIndex(0);
  }, [filtered, activeIndex]);

  if (!open) return null;

  function runCommand(command: PaletteCommand): void {
    if (command.id === "toggle-explorer") onToggleExplorer();
    if (command.id === "toggle-context") onToggleContext();
    onClose();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) runCommand(command);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="palette-anim w-full max-w-[560px] overflow-hidden rounded-panel border border-hairline bg-surface-raised shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
          <IconSearch width={15} height={15} className="text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando…"
            className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">Esc</kbd>
        </div>

        <ul className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] text-zinc-500">Sin resultados</li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runCommand(command)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[12px] outline-none transition-colors",
                    index === activeIndex ? "bg-harness/15 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/70",
                  )}
                >
                  <span className={index === activeIndex ? "text-harness-soft" : "text-zinc-500"}>{command.icon}</span>
                  <span className="flex-1">{command.label}</span>
                  <span className="font-mono text-[10px] text-zinc-600">{command.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
