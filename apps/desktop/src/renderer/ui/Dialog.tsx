import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { useFocusTrap } from "../shell/use-focus-trap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  /** Ancho máximo del panel. */
  maxWidth?: string;
  className?: string;
}

/**
 * Diálogo modal flotante. Se portaliza a `body` en su propia capa
 * (`--phs-z-dialog`), por encima de cualquier overlay previo, de modo que un
 * editor abierto desde Settings no cierre Settings ni comparta su Escape.
 */
export function Dialog({ open, onClose, label, children, maxWidth = "42rem", className }: DialogProps): React.ReactElement | null {
  const containerRef = useFocusTrap(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="layer-dialog flex items-center justify-center bg-black/60 p-6" onMouseDown={onClose} role="presentation">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
        style={{ maxWidth }}
        className={cn("overlay-surface palette-anim flex w-full flex-col overflow-hidden", className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
