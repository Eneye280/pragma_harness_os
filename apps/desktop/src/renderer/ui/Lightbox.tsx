import { useState } from "react";
import { useFocusTrap } from "../shell/use-focus-trap";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

/**
 * Visor de imágenes: overlay con zoom, ajuste a pantalla y cierre por Escape o
 * click fuera. Reutiliza el `useFocusTrap` compartido (pila de diálogos).
 */
export function Lightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }): React.ReactElement {
  const [zoom, setZoom] = useState(1);
  const containerRef = useFocusTrap(true, onClose);

  function step(delta: number): void {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))));
  }

  return (
    <div className="layer-dialog flex items-center justify-center bg-black/70 p-6" onMouseDown={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={image.caption ?? image.alt}
        className="relative flex max-h-full max-w-full flex-col overflow-hidden rounded-sheet border border-hairline bg-surface"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-300">{image.caption ?? image.alt}</span>
          <button
            type="button"
            aria-label="Alejar"
            onClick={() => step(-ZOOM_STEP)}
            className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <span aria-hidden="true">−</span>
          </button>
          <span className="w-11 text-center font-mono text-[12px] text-zinc-500">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Acercar"
            onClick={() => step(ZOOM_STEP)}
            className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-control border border-hairline text-zinc-400 transition-colors hover:text-red-300"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div
          className="max-h-[80vh] max-w-[88vw] overflow-auto bg-surface-sunken p-3"
          onWheel={(event) => {
            event.preventDefault();
            step(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            style={{ width: `${Math.round(zoom * 100)}%` }}
            className="mx-auto block max-w-none object-contain"
          />
        </div>
      </div>
    </div>
  );
}
