export const TYPE_SCALE = {
  hero: "var(--phs-text-hero)",
  title: "var(--phs-text-title)",
  subtitle: "var(--phs-text-subtitle)",
  body: "var(--phs-text-body)",
  label: "var(--phs-text-label)",
  caption: "var(--phs-text-caption)",
} as const;

export const SPACING = {
  xs: "var(--phs-space-1)",
  sm: "var(--phs-space-2)",
  md: "var(--phs-space-3)",
  lg: "var(--phs-space-4)",
  xl: "var(--phs-space-6)",
  xxl: "var(--phs-space-8)",
} as const;

export const RADIUS = {
  control: "var(--radius-control)",
  panel: "var(--radius-panel)",
  sheet: "var(--radius-sheet)",
  pill: "var(--radius-pill)",
} as const;

export const ELEVATION = {
  sm: "var(--phs-elevation-1)",
  md: "var(--phs-elevation-2)",
  lg: "var(--phs-elevation-3)",
} as const;

export const SURFACE_STYLES = ["glass", "glass-strong", "neumorph", "neumorph-inset", "card", "floating-panel", "floating-toolbar", "sheet"] as const;

export const REQUIRED_CSS_TOKENS = [
  "--phs-text-hero",
  "--phs-text-title",
  "--phs-text-body",
  "--phs-space-4",
  "--radius-pill",
  "--phs-neumorph",
  "--phs-neumorph-inset",
  "--phs-glass-border",
  "--phs-glass-highlight",
  "--phs-elevation-3",
] as const;

export const REQUIRED_CSS_UTILITIES = [".glass", ".glass-strong", ".neumorph", ".neumorph-inset", ".text-hero", ".text-title", ".text-body", ".elevation-3", ".tracking-label"] as const;

export function surfaceClass(style: (typeof SURFACE_STYLES)[number]): string {
  return style;
}
