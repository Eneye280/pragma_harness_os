export interface Accent {
  id: string;
  label: string;
  base: string;
  strong: string;
  soft: string;
  lightSoft: string;
}

/** 10 acentos seleccionables; se aplican con `data-accent` en :root. */
export const ACCENTS: Accent[] = [
  { id: "violet", label: "Violeta", base: "#8b5cf6", strong: "#7c3aed", soft: "#a78bfa", lightSoft: "#6d28d9" },
  { id: "blue", label: "Azul", base: "#3b82f6", strong: "#2563eb", soft: "#93c5fd", lightSoft: "#1d4ed8" },
  { id: "cyan", label: "Cian", base: "#06b6d4", strong: "#0891b2", soft: "#67e8f9", lightSoft: "#0e7490" },
  { id: "teal", label: "Turquesa", base: "#14b8a6", strong: "#0d9488", soft: "#5eead4", lightSoft: "#0f766e" },
  { id: "emerald", label: "Esmeralda", base: "#10b981", strong: "#059669", soft: "#6ee7b7", lightSoft: "#047857" },
  { id: "lime", label: "Lima", base: "#84cc16", strong: "#65a30d", soft: "#bef264", lightSoft: "#3f6212" },
  { id: "amber", label: "Ámbar", base: "#f59e0b", strong: "#d97706", soft: "#fcd34d", lightSoft: "#92400e" },
  { id: "orange", label: "Naranja", base: "#f97316", strong: "#ea580c", soft: "#fdba74", lightSoft: "#9a3412" },
  { id: "rose", label: "Rosa", base: "#f43f5e", strong: "#e11d48", soft: "#fda4af", lightSoft: "#9f1239" },
  { id: "pink", label: "Fucsia", base: "#ec4899", strong: "#db2777", soft: "#f9a8d4", lightSoft: "#9d174d" },
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
