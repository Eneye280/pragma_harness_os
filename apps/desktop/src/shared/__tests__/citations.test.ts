import { describe, expect, it } from "vitest";
import { extractCitations, formatCitations, hasCitations, veracityReview } from "../citations";

describe("citations and veracity", () => {
  it("extracts markdown links and bare urls once", () => {
    const text = "Ver [Docs](https://docs.unity3d.com/Manual/index.html) y https://nodejs.org/docs y otra vez https://nodejs.org/docs.";
    const citations = extractCitations(text);
    expect(citations.map((citation) => citation.url)).toEqual(["https://docs.unity3d.com/Manual/index.html", "https://nodejs.org/docs"]);
    expect(citations[0].title).toBe("Docs");
  });

  it("flags version/api claims without sources", () => {
    expect(veracityReview("Unity v6 introdujo cambios").ok).toBe(false);
    expect(veracityReview("Unity v6 introdujo cambios").reason).toMatch(/sin citar/);
    expect(veracityReview("Unity v6 cambió ([docs](https://docs.unity3d.com/x))").ok).toBe(true);
  });

  it("does not require sources for plain text", () => {
    const report = veracityReview("Listo, implementé la calculadora");
    expect(report.requiresSources).toBe(false);
    expect(report.ok).toBe(true);
    expect(hasCitations("sin links")).toBe(false);
  });

  it("formats citations", () => {
    const formatted = formatCitations(extractCitations("[A](https://a.dev)"));
    expect(formatted).toContain("[c1] A — https://a.dev");
    expect(formatCitations([])).toBe("");
  });
});
