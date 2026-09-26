import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { auditPalette, contrastRatio } from "../../theme/contrast";

const CSS_PATH = join(process.cwd(), "src", "renderer", "styles", "globals.css");

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
});
