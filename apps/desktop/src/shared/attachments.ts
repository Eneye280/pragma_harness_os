export type AttachmentKind = "image" | "document";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  dataUrl?: string;
  text?: string;
  description?: string;
}

export function pngSizeFromDataUrl(dataUrl: string | undefined): { width: number; height: number } | null {
  if (!dataUrl) return null;
  const base64 = dataUrl.split(",")[1];
  if (!base64) return null;
  try {
    const binary = atob(base64.slice(0, 64));
    if (binary.length < 24) return null;
    const byte = (index: number): number => binary.charCodeAt(index);
    const isPng = byte(0) === 0x89 && byte(1) === 0x50 && byte(2) === 0x4e && byte(3) === 0x47;
    if (!isPng) return null;
    const width = ((byte(16) << 24) | (byte(17) << 16) | (byte(18) << 8) | byte(19)) >>> 0;
    const height = ((byte(20) << 24) | (byte(21) << 16) | (byte(22) << 8) | byte(23)) >>> 0;
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}

export function describeAttachment(attachment: Attachment): string {
  const sizeLabel = `${Math.max(1, Math.round(attachment.size / 1024))}KB`;
  if (attachment.kind === "image") {
    const dims = pngSizeFromDataUrl(attachment.dataUrl);
    return `imagen "${attachment.name}" (${attachment.mime}, ${dims ? `${dims.width}x${dims.height}` : sizeLabel})`;
  }
  return `documento "${attachment.name}" (${attachment.mime}, ${sizeLabel})`;
}

export function buildAttachmentNote(attachments: Attachment[] | undefined): string {
  if (!attachments || attachments.length === 0) return "";
  return attachments
    .map((attachment) => {
      const base = attachment.description || describeAttachment(attachment);
      const excerpt = attachment.text ? ` — ${chunkText(attachment.text)}` : "";
      return `- ${base}${excerpt}`;
    })
    .join("\n");
}

export const ATTACHMENT_TEXT_LIMIT = 6000;

export function chunkText(text: string, maxChars: number = ATTACHMENT_TEXT_LIMIT): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…[truncado ${normalized.length - maxChars} chars]`;
}

export function estimateAttachmentTokens(attachment: Attachment): number {
  if (attachment.kind === "image") return 200;
  return Math.ceil((attachment.text?.length ?? 0) / 4);
}

export function totalAttachmentTokens(attachments: Attachment[]): number {
  return attachments.reduce((sum, attachment) => sum + estimateAttachmentTokens(attachment), 0);
}
