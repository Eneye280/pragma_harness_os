import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";

export interface HtmlCaptureResult {
  ok: boolean;
  detail: string;
  title?: string;
  consoleErrors: string[];
  png?: Buffer;
}

/**
 * Abre un HTML local en una ventana oculta, espera el render y captura la
 * pantalla. Recoge además los errores/warnings de consola reales.
 */
export async function captureHtmlPage(absolutePath: string, waitMs = 700): Promise<HtmlCaptureResult> {
  const consoleErrors: string[] = [];
  let win: BrowserWindow | null = null;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: true, nodeIntegration: false },
    });
    const target = win;
    target.webContents.on("console-message", (_event, level, message) => {
      const numeric = typeof level === "number" ? level : Number.parseInt(String(level), 10);
      if (Number.isFinite(numeric) && numeric >= 2) consoleErrors.push(String(message).slice(0, 300));
    });

    await target.loadURL(pathToFileURL(absolutePath).toString());
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const title = target.webContents.getTitle();
    const image = await target.webContents.capturePage();
    const png = image.toPNG();
    return { ok: true, detail: `captura ${image.getSize().width}×${image.getSize().height}`, title, consoleErrors, png };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "no se pudo capturar", consoleErrors };
  } finally {
    win?.destroy();
  }
}
