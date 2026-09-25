import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { IconCommand, IconFile, IconFolder, IconPanelLeft, IconPanelRight, IconSearch } from "./icons";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  group: "commands" | "files";
  icon: React.ReactNode;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
  onOpenSettings: () => void;
  files: string[];
  onOpenFile: (path: string) => void;
}

const MAX_FILE_RESULTS = 8;

export function CommandPalette({
  open,
  onClose,
  onToggleExplorer,
  onToggleContext,
  onOpenSettings,
  files,
  onOpenFile,
}: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const commands: PaletteItem[] = [
      { id: "toggle-explorer", label: "Toggle Explorer", hint: "Ctrl/Cmd+B", group: "commands", icon: <IconPanelLeft width={14} height={14} />, run: onToggleExplorer },
      { id: "toggle-context", label: "Toggle Context", hint: "Ctrl/Cmd+Shift+C", group: "commands", icon: <IconPanelRight width={14} height={14} />, run: onToggleContext },
      { id: "open-workspace", label: "Open workspace", hint: "TASK 14/20", group: "commands", icon: <IconFolder width={14} height={14} />, run: () => undefined },
      { id: "settings", label: "Open settings", hint: "Ctrl/Cmd+,", group: "commands", icon: <IconCommand width={14} height={14} />, run: onOpenSettings },
    ];
    const fileItems: PaletteItem[] = files.map((filePath) => ({
      id: `file:${filePath}`,
      label: filePath,
      hint: "abrir",
      group: "files",
      icon: <IconFile width={14} height={14} />,
      run: () => onOpenFile(filePath),
    }));

    const normalizedQuery = query.trim().toLowerCase();
    const matchingCommands = commands.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
    const matchingFiles = normalizedQuery
      ? fileItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery)).slice(0, MAX_FILE_RESULTS)
      : fileItems.slice(0, MAX_FILE_RESULTS);
    return [...matchingCommands, ...matchingFiles];
  }, [query, files, onToggleExplorer, onToggleContext, onOpenFile, onOpenSettings]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex > items.length - 1) setActiveIndex(0);
  }, [items, activeIndex]);

  if (!open) return null;

  function runItem(item: PaletteItem): void {
    item.run();
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
      setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) runItem(item);
    }
  }

  let lastGroup: PaletteItem["group"] | null = null;

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
            placeholder="Comando o archivo… (Ctrl/Cmd+P)"
            className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">Esc</kbd>
        </div>

        <ul className="max-h-[320px] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] text-zinc-500">Sin resultados</li>
          ) : (
            items.map((item, index) => {
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.id}>
                  {showHeader ? (
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                      {item.group === "commands" ? "Comandos" : "Archivos"}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runItem(item)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[12px] outline-none transition-colors",
                      index === activeIndex ? "bg-harness/15 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/70",
                    )}
                  >
                    <span className={index === activeIndex ? "text-harness-soft" : "text-zinc-500"}>{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="font-mono text-[10px] text-zinc-600">{item.hint}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
