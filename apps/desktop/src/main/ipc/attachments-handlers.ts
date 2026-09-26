import { ipcMain } from "electron";
import { extractPdfText } from "../attachments/pdf";

export function registerAttachmentsHandlers(): void {
  ipcMain.handle("attachments:extractText", async (_event, rawDataUrl: unknown) => {
    if (typeof rawDataUrl !== "string" || !rawDataUrl.startsWith("data:")) {
      return { error: "invalid data url", text: "" };
    }
    const base64 = rawDataUrl.split(",")[1];
    if (!base64) return { error: "empty payload", text: "" };
    try {
      const buffer = Buffer.from(base64, "base64");
      const text = extractPdfText(buffer);
      return { error: null, text };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "extract failed", text: "" };
    }
  });
}
