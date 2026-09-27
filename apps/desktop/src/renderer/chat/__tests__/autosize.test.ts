import { describe, expect, it } from "vitest";
import { COMPOSER_MAX_HEIGHT, nextTextareaHeight } from "../use-autosize-textarea";

describe("composer autosize", () => {
  it("grows with the content up to the maximum", () => {
    expect(nextTextareaHeight(60)).toBe(60);
    expect(nextTextareaHeight(COMPOSER_MAX_HEIGHT)).toBe(COMPOSER_MAX_HEIGHT);
    expect(nextTextareaHeight(COMPOSER_MAX_HEIGHT + 500)).toBe(COMPOSER_MAX_HEIGHT);
  });

  it("honours a custom maximum and rounds fractions", () => {
    expect(nextTextareaHeight(999, 120)).toBe(120);
    expect(nextTextareaHeight(48.6, 200)).toBe(49);
  });

  it("clamps invalid heights to zero", () => {
    expect(nextTextareaHeight(Number.NaN)).toBe(0);
    expect(nextTextareaHeight(Number.POSITIVE_INFINITY)).toBe(0);
    expect(nextTextareaHeight(-40)).toBe(0);
  });
});
