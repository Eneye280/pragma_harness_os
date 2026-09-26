import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { auditPalette, contrastRatio } from "../../theme/contrast";
import { REQUIRED_CSS_TOKENS, REQUIRED_CSS_UTILITIES } from "../../theme/tokens";

const CSS_PATH = join(process.cwd(), "src", "renderer", "styles", "globals.css");
const RENDERER_DIR = join(process.cwd(), "src", "renderer");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("floating design system", () => {
  it("defines elevation, blur, radius and motion tokens", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    for (const token of ["--phs-elevation-1", "--phs-elevation-2", "--phs-elevation-3", "--phs-blur", "--phs-blur-strong", "--radius-sheet"]) {
      expect(css).toContain(token);
    }
    for (const utility of [".floating-panel", ".floating-toolbar", ".sheet", ".card"]) {
      expect(css).toContain(utility);
    }
    expect(css).toContain("backdrop-filter: blur(var(--phs-blur))");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("defines the v2 typography, spacing and glass/neumorph tokens", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    for (const token of REQUIRED_CSS_TOKENS) expect(css, token).toContain(token);
    for (const utility of REQUIRED_CSS_UTILITIES) expect(css, utility).toContain(utility);
    expect(css).toContain("box-shadow: var(--phs-neumorph)");
    expect(css).toContain("box-shadow: var(--phs-elevation-2), var(--phs-glass-highlight)");
  });

  it("keeps the palette at AA contrast on the dark surface", () => {
    for (const check of auditPalette()) {
      expect(check.ratio, `${check.pair} = ${check.ratio}`).toBeGreaterThanOrEqual(check.min);
      expect(check.passesAA).toBe(true);
    }
  });

  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBe(21);
    expect(contrastRatio("#000000", "#000000")).toBe(1);
  });

  it("keeps shadows reduced (v1.0.2.1, ≈35% softer)", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toContain("--phs-elevation-1: 0 1px 1px rgba(0, 0, 0, 0.12)");
    expect(css).toContain("--phs-elevation-3: 0 9px 22px rgba(0, 0, 0, 0.16)");
    const alphas = [...css.matchAll(/--phs-(?:elevation|neumorph)[^;]*rgba\(0, 0, 0, ([\d.]+)\)/g)].map((match) => Number(match[1]));
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.17);
  });

  it("never uses type below 12px in the renderer", () => {
    const offenders: string[] = [];
    for (const file of walk(RENDERER_DIR)) {
      const content = readFileSync(file, "utf8");
      if (/text-\[(?:[0-9]|1[01])px\]/.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("defines a single overlay layer system above the content", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    for (const token of ["--phs-z-panel", "--phs-z-overlay", "--phs-z-toast"]) expect(css).toContain(token);
    for (const utility of [".layer-overlay", ".layer-toast", ".overlay-surface", ".field"]) expect(css).toContain(utility);
  });
});
