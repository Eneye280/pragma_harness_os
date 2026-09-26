export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "").trim();
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`invalid hex color: ${hex}`);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  const darker = Math.min(relativeLuminance(hexToRgb(foreground)), relativeLuminance(hexToRgb(background)));
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export const PALETTE = {
  surface: "#09090b",
  surfaceRaised: "#18181b",
  hairline: "#27272a",
  textPrimary: "#f4f4f5",
  textMuted: "#a1a1aa",
  harness: "#8b5cf6",
  harnessSoft: "#a78bfa",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

export interface ContrastCheck {
  pair: string;
  ratio: number;
  min: number;
  passesAA: boolean;
  passesAAA: boolean;
}

export function auditPalette(): ContrastCheck[] {
  const pairs: Array<{ pair: string; foreground: string; background: string; min: number }> = [
    { pair: "textPrimary/surface", foreground: PALETTE.textPrimary, background: PALETTE.surface, min: 4.5 },
    { pair: "textPrimary/surfaceRaised", foreground: PALETTE.textPrimary, background: PALETTE.surfaceRaised, min: 4.5 },
    { pair: "textMuted/surface", foreground: PALETTE.textMuted, background: PALETTE.surface, min: 4.5 },
    { pair: "harnessSoft/surface", foreground: PALETTE.harnessSoft, background: PALETTE.surface, min: 4.5 },
    { pair: "success/surface", foreground: PALETTE.success, background: PALETTE.surface, min: 4.5 },
    { pair: "warning/surface", foreground: PALETTE.warning, background: PALETTE.surface, min: 4.5 },
    { pair: "danger/surface", foreground: PALETTE.danger, background: PALETTE.surface, min: 4.5 },
  ];
  return pairs.map(({ pair, foreground, background, min }) => {
    const ratio = contrastRatio(foreground, background);
    return { pair, ratio, min, passesAA: ratio >= min, passesAAA: ratio >= 7 };
  });
}
