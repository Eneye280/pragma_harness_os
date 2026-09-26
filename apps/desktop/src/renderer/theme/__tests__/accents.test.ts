import { describe, expect, it } from "vitest";
import { ACCENTS, accentById, isAccentId, resolveAccent } from "../accents";

describe("accent themes", () => {
  it("offers ten distinct accents with valid colors", () => {
    expect(ACCENTS).toHaveLength(10);
    const ids = ACCENTS.map((accent) => accent.id);
    expect(new Set(ids).size).toBe(10);
    for (const accent of ACCENTS) {
      expect(accent.base).toMatch(/^#[0-9a-f]{6}$/i);
      expect(accent.strong).toMatch(/^#[0-9a-f]{6}$/i);
      expect(accent.soft).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("resolves valid ids and falls back to the default", () => {
    expect(isAccentId("amber")).toBe(true);
    expect(isAccentId("nope")).toBe(false);
    expect(resolveAccent("teal")).toBe("teal");
    expect(resolveAccent("nope")).toBe("violet");
    expect(accentById("rose").label).toBe("Rosa");
  });
});