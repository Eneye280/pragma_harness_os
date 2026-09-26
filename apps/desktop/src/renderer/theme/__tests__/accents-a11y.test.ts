import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ACCENTS } from "../accents";
import { contrastRatio } from "../contrast";

const CSS = readFileSync(join(process.cwd(), "src", "renderer", "styles", "globals.css"), "utf8");
const DARK_SURFACE = "#0a0a0c";
const LIGHT_SURFACE = "#f3f3f5";

describe("accent accessibility", () => {
  it("keeps the accent text color at AA contrast in dark and light", () => {
    for (const accent of ACCENTS) {
      const dark = contrastRatio(accent.soft, DARK_SURFACE);
      const light = contrastRatio(accent.lightSoft, LIGHT_SURFACE);
      expect(dark, `${accent.id} soft on dark = ${dark.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      expect(light, `${accent.id} lightSoft on light = ${light.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps globals.css in sync with the accent tokens", () => {
    expect(CSS).toContain(`:root[data-accent="blue"] { --color-harness: #3b82f6`);
    for (const accent of ACCENTS) {
      expect(CSS, `light override for ${accent.id}`).toContain(`:root[data-theme="light"][data-accent="${accent.id}"] { --color-harness-soft: ${accent.lightSoft}; }`);
    }
  });
});
