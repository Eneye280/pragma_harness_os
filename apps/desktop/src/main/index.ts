import { app, BrowserWindow } from "electron";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { is } from "@electron-toolkit/utils";
import { startHarnessServer } from "./server/hono";
import { registerIpcHandlers } from "./ipc/handlers";
import { registerWindowControls } from "./ipc/window-controls";
import { registerExplorerHandlers } from "./ipc/explorer-handlers";
import { registerTerminalHandlers } from "./ipc/terminal-handlers";
import { registerSettingsHandlers } from "./ipc/settings-handlers";
import { resolveHarnessWorkspace } from "./workspace-path";
import { SettingsController, SettingsStore } from "./settings";

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
  const settingsController = new SettingsController(new SettingsStore());
  createWindow();
  startHarnessServer(4096);
  registerIpcHandlers(() => mainWindow, settingsController);
  registerWindowControls(() => mainWindow);
  registerExplorerHandlers(() => mainWindow, resolveHarnessWorkspace());
  registerTerminalHandlers(() => mainWindow, resolveHarnessWorkspace());
  registerSettingsHandlers(() => mainWindow, settingsController);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
