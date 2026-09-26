import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  align?: "left" | "right";
  trigger?: React.ReactNode;
}

export function Menu({ label, items, align = "right", trigger }: MenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function focusItem(delta: number): void {
    const buttons = Array.from(listRef.current?.querySelectorAll("button") ?? []);
    if (buttons.length === 0) return;
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    (buttons[nextIndex] as HTMLButtonElement).focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setTimeout(() => focusItem(1), 0);
          }
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-control px-2 py-1 text-zinc-400 outline-none transition-colors hover:bg-zinc-800 hover:text-zinc-100",
          open ? "bg-zinc-800 text-zinc-100" : "",
        )}
      >
        {trigger ?? <span className="text-[11px]">{label}</span>}
      </button>
      {open ? (
        <div
          ref={listRef}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            else if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(-1);
            }
          }}
          className={cn("glass-strong palette-anim absolute top-[calc(100%+6px)] z-50 w-56 rounded-panel p-1", align === "right" ? "right-0" : "left-0")}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[12px] text-zinc-300 outline-none transition-colors hover:bg-harness/15 hover:text-zinc-100 focus-visible:bg-harness/20"
            >
              <span>{item.label}</span>
              {item.hint ? <span className="ml-auto font-mono text-[10px] text-zinc-500">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
