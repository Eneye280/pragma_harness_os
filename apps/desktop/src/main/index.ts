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
import { registerUpdaterHandlers } from "./ipc/updater-handlers";
import { registerWorkspaceHandlers } from "./ipc/workspace-handlers";
import { SettingsController, SettingsStore } from "./settings";
import { CostTracker } from "./cost";
import { createUpdaterHost } from "./updater";
import { WorkspaceFolderController } from "./workspace-folder";

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
  const costTracker = new CostTracker();
  const workspace = new WorkspaceFolderController({ store: settingsController.store });
  const updater = createUpdaterHost();
  createWindow();
  startHarnessServer(4096);
  registerIpcHandlers(() => mainWindow, settingsController, costTracker, workspace);
  registerWindowControls(() => mainWindow);
  registerExplorerHandlers(() => mainWindow, workspace);
  registerTerminalHandlers(() => mainWindow, workspace);
  registerSettingsHandlers(() => mainWindow, settingsController);
  registerUpdaterHandlers(() => mainWindow, updater);
  registerWorkspaceHandlers(() => mainWindow, workspace);
  updater.init();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
