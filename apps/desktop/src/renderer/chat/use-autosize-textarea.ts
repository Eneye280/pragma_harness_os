import { useEffect, useRef } from "react";

/** Alto máximo del composer (px). A partir de aquí hace scroll interno. */
export const COMPOSER_MAX_HEIGHT = 260;

/** Alto resultante para un `scrollHeight` dado, topado al máximo. */
export function nextTextareaHeight(scrollHeight: number, max: number = COMPOSER_MAX_HEIGHT): number {
  if (!Number.isFinite(scrollHeight)) return 0;
  return Math.min(max, Math.max(0, Math.round(scrollHeight)));
}

/**
 * Ajusta la altura del `textarea` a su contenido, creciendo hasta `max` y
 * activando el scroll interno al superarlo. Devuelve el ref a asignar.
 */
export function useAutosizeTextarea(value: string, max: number = COMPOSER_MAX_HEIGHT) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    const scrollHeight = element.scrollHeight;
    element.style.height = `${nextTextareaHeight(scrollHeight, max)}px`;
    element.style.overflowY = scrollHeight > max ? "auto" : "hidden";
  }, [value, max]);

  return ref;
}
