export const palette = {
  zinc950: "#09090b",
  zinc900: "#18181b",
  zinc850: "#1f1f23",
  zinc800: "#27272a",
  zinc700: "#3f3f46",
  zinc600: "#52525b",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc300: "#d4d4d8",
  zinc100: "#f4f4f5",
  violet: "#8B5CF6",
  violet600: "#7c3aed",
  violet400: "#a78bfa",
  emerald: "#22C55E",
  amber: "#f59e0b",
  red: "#ef4444",
} as const;

export const layout = {
  titleBarHeight: 38,
  explorerWidth: 260,
  contextWidth: 320,
  chatMaxWidth: 780,
} as const;

export const motion = {
  fastMs: 150,
  baseMs: 200,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

export const typography = {
  ui: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  code: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const tokens = {
  color: palette,
  layout,
  motion,
  typography,
  radius: { panel: "0.75rem", control: "0.5rem", chip: "9999px" },
} as const;

export function tokensToCssVariables(): string {
  const lines = [
    `--phs-surface: ${palette.zinc950};`,
    `--phs-surface-raised: ${palette.zinc900};`,
    `--phs-hairline: ${palette.zinc800};`,
    `--phs-harness: ${palette.violet};`,
    `--phs-success: ${palette.emerald};`,
    `--phs-warning: ${palette.amber};`,
    `--phs-danger: ${palette.red};`,
    `--phs-text: ${palette.zinc100};`,
    `--phs-text-muted: ${palette.zinc400};`,
    `--phs-titlebar-height: ${layout.titleBarHeight}px;`,
    `--phs-explorer-width: ${layout.explorerWidth}px;`,
    `--phs-context-width: ${layout.contextWidth}px;`,
    `--phs-motion-fast: ${motion.fastMs}ms;`,
    `--phs-motion-base: ${motion.baseMs}ms;`,
  ];
  return `:root {\n  ${lines.join("\n  ")}\n}\n`;
}

export type PragmaTokens = typeof tokens;
