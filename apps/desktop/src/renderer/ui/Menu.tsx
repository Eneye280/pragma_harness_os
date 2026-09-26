import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}

export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

interface MenuProps {
  label: string;
  items: MenuItem[] | MenuGroup[];
  align?: "left" | "right";
  trigger?: React.ReactNode;
  header?: string;
}

function toGroups(items: MenuItem[] | MenuGroup[]): MenuGroup[] {
  if (items.length === 0) return [];
  if ("items" in items[0]) return items as MenuGroup[];
  return [{ items: items as MenuItem[] }];
}

/**
 * Menú flotante portalizado a body: nunca queda detrás de paneles ni del chat,
 * sin importar cuántos stacking contexts (`backdrop-filter`) haya debajo.
 */
export function Menu({ label, items, align = "right", trigger, header }: MenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const groups = toGroups(items);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left, right: Math.max(8, window.innerWidth - rect.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!listRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = (): void => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function focusItem(delta: number): void {
    const buttons = Array.from(listRef.current?.querySelectorAll("button") ?? []);
    if (buttons.length === 0) return;
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    (buttons[nextIndex] as HTMLButtonElement).focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
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
          "flex h-8 items-center gap-1.5 rounded-control border border-transparent px-2 text-zinc-400 outline-none transition-colors hover:border-hairline hover:bg-surface-raised hover:text-zinc-100",
          open ? "border-hairline bg-surface-raised text-zinc-100" : "",
        )}
      >
        {trigger ?? <span className="text-[13px]">{label}</span>}
      </button>
      {open && coords
        ? createPortal(
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
              style={{ position: "fixed", top: coords.top, left: align === "left" ? coords.left : undefined, right: align === "right" ? coords.right : undefined, zIndex: "var(--phs-z-overlay)" }}
              className="overlay-surface palette-anim w-64 p-1.5"
            >
              {header ? <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-zinc-200">{header}</p> : null}
              {groups.map((group, groupIndex) => (
                <div key={group.label ?? groupIndex} className={groupIndex > 0 ? "mt-1 border-t border-hairline pt-1" : ""}>
                  {group.label ? <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-zinc-500">{group.label}</p> : null}
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        item.onSelect();
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] text-zinc-300 outline-none transition-colors hover:bg-harness/15 hover:text-zinc-100 focus-visible:bg-harness/20"
                    >
                      <span>{item.label}</span>
                      {item.hint ? <span className="ml-auto font-mono text-[12px] text-zinc-500">{item.hint}</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
