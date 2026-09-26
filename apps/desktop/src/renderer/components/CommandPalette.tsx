import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../shell/use-focus-trap";
import { COMMAND_GROUP_LABEL, filterCommands, type PaletteCommand } from "../shell/commands";
import { IconFile, IconSearch } from "./icons";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  files: string[];
  onOpenFile: (path: string) => void;
}

interface Row {
  id: string;
  group: string;
  label: string;
  hint?: string;
  file: boolean;
  run: () => void;
}

const GROUP_GLYPH: Record<string, string> = {
  Ejecutar: "▶",
  Proyecto: "▸",
  Paneles: "▤",
  Vistas: "◫",
  Ajustes: "⚙",
  Apariencia: "◐",
  Archivos: "≡",
};

const MAX_FILE_RESULTS = 6;

export function CommandPalette({ open, onClose, commands, files, onOpenFile }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useFocusTrap(open, onClose);

  const rows = useMemo<Row[]>(() => {
    const matched = filterCommands(commands, query).map<Row>((command) => ({
      id: `cmd:${command.id}`,
      group: COMMAND_GROUP_LABEL[command.group],
      label: command.label,
      hint: command.hint,
      file: false,
      run: command.run,
    }));
    const normalized = query.trim().toLowerCase();
    const matchedFiles = files
      .filter((path) => !normalized || path.toLowerCase().includes(normalized))
      .slice(0, MAX_FILE_RESULTS)
      .map<Row>((path) => ({ id: `file:${path}`, group: "Archivos", label: path, file: true, run: () => onOpenFile(path) }));
    return [...matched, ...matchedFiles];
  }, [commands, files, query, onOpenFile]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex > rows.length - 1) setActiveIndex(0);
  }, [rows, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const row = rows[activeIndex];
    if (row) optionRefs.current.get(row.id)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, rows, open]);

  if (!open) return null;

  function runRow(row: Row): void {
    row.run();
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
      setActiveIndex((index) => (rows.length === 0 ? 0 : (index + 1) % rows.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (rows.length === 0 ? 0 : (index - 1 + rows.length) % rows.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) runRow(row);
    }
  }

  let lastGroup: string | null = null;

  return (
    <div className="layer-overlay flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div
        ref={containerRef}
        className="overlay-surface palette-anim flex max-h-[70vh] w-full max-w-[600px] flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3.5">
          <IconSearch width={16} height={16} className="text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una acción o un archivo…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={rows[activeIndex]?.id}
            aria-label="Buscar acción o archivo"
            className="flex-1 bg-transparent text-[14px] text-zinc-100 outline-none"
          />
          <kbd className="rounded-control border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[12px] text-zinc-500">Esc</kbd>
        </div>

        <ul id="palette-listbox" role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-zinc-500">Sin resultados</li>
          ) : (
            rows.map((row, index) => {
              const showHeader = row.group !== lastGroup;
              lastGroup = row.group;
              return (
                <li key={row.id}>
                  {showHeader ? (
                    <p className="px-2.5 pb-1 pt-2.5 text-[12px] font-medium text-zinc-500">{row.group}</p>
                  ) : null}
                  <button
                    type="button"
                    id={row.id}
                    role="option"
                    aria-selected={index === activeIndex}
                    ref={(element) => {
                      if (element) optionRefs.current.set(row.id, element);
                      else optionRefs.current.delete(row.id);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runRow(row)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] outline-none transition-colors",
                      index === activeIndex ? "bg-harness/20 text-zinc-100" : "text-zinc-300 hover:bg-surface-raised/70",
                    )}
                  >
                    <span className={cn("w-4 shrink-0 text-center", index === activeIndex ? "text-harness-soft" : "text-zinc-500")} aria-hidden="true">
                      {row.file ? <IconFile width={14} height={14} /> : (GROUP_GLYPH[row.group] ?? "•")}
                    </span>
                    <span className="flex-1 truncate">{row.label}</span>
                    {row.hint ? <span className="font-mono text-[12px] text-zinc-500">{row.hint}</span> : null}
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
