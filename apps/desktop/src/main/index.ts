import { app, BrowserWindow } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { is } from "@electron-toolkit/utils";
import { startHarnessServer } from "./server/hono";
import { registerIpcHandlers } from "./ipc/handlers";
import { registerWindowControls } from "./ipc/window-controls";

const currentDir = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: join(currentDir, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(currentDir, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  startHarnessServer(4096);
  registerIpcHandlers(() => mainWindow);
  registerWindowControls(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
