import { describe, it, expect } from "vitest";
import { extractPdfText } from "../pdf";

const PDF = [
  "%PDF-1.4",
  "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
  "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
  "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj",
  "4 0 obj << /Length 60 >>",
  "stream",
  "BT /F1 24 Tf 100 700 Td (Hola mundo PDF) Tj ET",
  "endstream",
  "endobj",
  "%%EOF",
].join("\n");

describe("extractPdfText", () => {
  it("extracts text from an uncompressed content stream", () => {
    const text = extractPdfText(Buffer.from(PDF, "latin1"));
    expect(text).toContain("Hola mundo PDF");
  });

  it("extracts text from TJ arrays", () => {
    const pdf = ["stream", "BT [(Hello )(World)] TJ ET", "endstream"].join("\n");
    expect(extractPdfText(Buffer.from(pdf, "latin1"))).toContain("Hello World");
  });

  it("returns an empty string for a PDF without extractable text", () => {
    expect(extractPdfText(Buffer.from("%PDF-1.4\nstream\nq 1 0 0 1 0 0 cm Q\nendstream", "latin1"))).toBe("");
  });
});
