import { describe, it, expect } from "vitest";
import { buildAttachmentNote, chunkText, describeAttachment, pngSizeFromDataUrl, type Attachment } from "../attachments";

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function image(overrides: Partial<Attachment> = {}): Attachment {
  return { id: "a1", kind: "image", name: "shot.png", mime: "image/png", size: 2048, dataUrl: PNG_1x1, ...overrides };
}

describe("attachments", () => {
  it("reads PNG dimensions from a data URL", () => {
    expect(pngSizeFromDataUrl(PNG_1x1)).toEqual({ width: 1, height: 1 });
    expect(pngSizeFromDataUrl("data:image/png;base64,notbase64!!")).toBeNull();
    expect(pngSizeFromDataUrl(undefined)).toBeNull();
  });

  it("describes an image with its dimensions", () => {
    expect(describeAttachment(image())).toBe('imagen "shot.png" (image/png, 1x1)');
  });

  it("describes an image without dimensions by size and a document by name", () => {
    expect(describeAttachment(image({ dataUrl: undefined }))).toBe('imagen "shot.png" (image/png, 2KB)');
    expect(describeAttachment({ id: "d", kind: "document", name: "req.pdf", mime: "application/pdf", size: 51200 })).toBe(
      'documento "req.pdf" (application/pdf, 50KB)'
    );
  });

  it("builds a note listing every attachment with an excerpt", () => {
    const note = buildAttachmentNote([
      image(),
      { id: "d", kind: "document", name: "req.txt", mime: "text/plain", size: 10, text: "  requisitos   del sistema  " },
    ]);
    expect(note).toContain('imagen "shot.png" (image/png, 1x1)');
    expect(note).toContain('documento "req.txt" (text/plain, 1KB) — requisitos del sistema');
    expect(buildAttachmentNote([])).toBe("");
    expect(buildAttachmentNote(undefined)).toBe("");
  });

  it("chunks long text with a truncation marker", () => {
    expect(chunkText("hola   mundo", 100)).toBe("hola mundo");
    const long = "x".repeat(50);
    const chunked = chunkText(long, 10);
    expect(chunked.startsWith("x".repeat(10))).toBe(true);
    expect(chunked).toContain("[truncado 40 chars]");
  });
});
