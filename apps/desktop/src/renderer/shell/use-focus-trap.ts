import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Pila de traps activos. Solo el trap superior (el último registrado) consume
 * Escape: así un diálogo anidado no cierra también la ventana que lo contiene.
 */
const trapStack: symbol[] = [];

export function useFocusTrap(active: boolean, onEscape: () => void): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const idRef = useRef<symbol>(Symbol("focus-trap"));
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const id = idRef.current;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    trapStack.push(id);

    const container = containerRef.current;
    container?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (trapStack[trapStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const index = trapStack.lastIndexOf(id);
      if (index !== -1) trapStack.splice(index, 1);
      previouslyFocused.current?.focus();
    };
  }, [active]);

  return containerRef;
}
