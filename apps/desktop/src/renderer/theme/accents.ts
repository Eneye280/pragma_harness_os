export interface Accent {
  id: string;
  label: string;
  base: string;
  strong: string;
  soft: string;
}

/** 10 acentos seleccionables; se aplican con `data-accent` en :root. */
export const ACCENTS: Accent[] = [
  { id: "violet", label: "Violeta", base: "#8b5cf6", strong: "#7c3aed", soft: "#a78bfa" },
  { id: "blue", label: "Azul", base: "#3b82f6", strong: "#2563eb", soft: "#93c5fd" },
  { id: "cyan", label: "Cian", base: "#06b6d4", strong: "#0891b2", soft: "#67e8f9" },
  { id: "teal", label: "Turquesa", base: "#14b8a6", strong: "#0d9488", soft: "#5eead4" },
  { id: "emerald", label: "Esmeralda", base: "#10b981", strong: "#059669", soft: "#6ee7b7" },
  { id: "lime", label: "Lima", base: "#84cc16", strong: "#65a30d", soft: "#bef264" },
  { id: "amber", label: "Ámbar", base: "#f59e0b", strong: "#d97706", soft: "#fcd34d" },
  { id: "orange", label: "Naranja", base: "#f97316", strong: "#ea580c", soft: "#fdba74" },
  { id: "rose", label: "Rosa", base: "#f43f5e", strong: "#e11d48", soft: "#fda4af" },
  { id: "pink", label: "Fucsia", base: "#ec4899", strong: "#db2777", soft: "#f9a8d4" },
];

export const ACCENT_STORAGE_KEY = "pragma-harness:accent";
export const DEFAULT_ACCENT = "violet";

export function isAccentId(value: unknown): value is string {
  return typeof value === "string" && ACCENTS.some((accent) => accent.id === value);
}

export function resolveAccent(value: unknown): string {
  return isAccentId(value) ? value : DEFAULT_ACCENT;
}

export function accentById(id: string): Accent {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}
