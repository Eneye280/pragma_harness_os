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
import { registerGitHandlers } from "./ipc/git-handlers";
import { registerSkillsHandlers } from "./ipc/skills-handlers";
import { registerAgentsHandlers } from "./ipc/agents-handlers";
import { registerBundlesHandlers } from "./ipc/bundles-handlers";
import { registerSessionsHandlers } from "./ipc/sessions-handlers";
import { registerAttachmentsHandlers } from "./ipc/attachments-handlers";
import { registerRagHandlers } from "./ipc/rag-handlers";
import { JsonSessionRepository, SessionStore } from "./sessions";
import { skillCompiler } from "./harness/skills/skill-compiler";
import { AgentCatalog } from "./agents";
import { configureAgentProvider } from "./context";
import { configureRagExcludes } from "./context";
import { SettingsController, SettingsStore } from "./settings";
import { CostTracker } from "./cost";
import { createUpdaterHost } from "./updater";
import { WorkspaceFolderController } from "./workspace-folder";
import { ProjectProfileStore } from "./profile";

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
  const settingsStore = new SettingsStore();
  const settingsController = new SettingsController(settingsStore);
  const costTracker = new CostTracker();
  const workspace = new WorkspaceFolderController({ store: settingsStore });
  const profileStore = new ProjectProfileStore();
  settingsStore.useProfile(() => profileStore.read(workspace.current()));
  settingsController.useProfileInfo(() => profileStore.info(workspace.current()));
  skillCompiler.useRoots(() => [
    workspace.current(),
    join(process.cwd(), "..", ".."),
    join(process.cwd(), ".."),
    process.cwd(),
  ]);
  skillCompiler.useEnabled(() => settingsStore.get().skills);
  const agentCatalog = new AgentCatalog();
  configureAgentProvider((domain) => {
    const { agent } = agentCatalog.selectFor(domain, settingsStore.get().agent || null);
    return agent ? { id: agent.id, name: agent.name, prompt: agent.prompt, skills: agent.skills } : null;
  });
  const updater = createUpdaterHost();
  createWindow();
  startHarnessServer(4096);
  registerIpcHandlers(() => mainWindow, settingsController, costTracker, workspace);
  registerWindowControls(() => mainWindow);
  registerExplorerHandlers(() => mainWindow, workspace);
  registerTerminalHandlers(() => mainWindow, workspace);
  registerSettingsHandlers(() => mainWindow, settingsController, profileStore, workspace);
  registerUpdaterHandlers(() => mainWindow, updater);
  registerWorkspaceHandlers(() => mainWindow, workspace);
  registerGitHandlers(workspace);
  registerSkillsHandlers(() => mainWindow, settingsController);
  registerAgentsHandlers(() => mainWindow, settingsController, agentCatalog);
  registerBundlesHandlers(workspace, profileStore, agentCatalog);
  const sessionStore = new SessionStore(new JsonSessionRepository(join(app.getPath("userData"), "pragma-harness", "sessions")));
  registerSessionsHandlers(() => sessionStore);
  registerAttachmentsHandlers();
  registerRagHandlers(() => mainWindow, profileStore, workspace);
  configureRagExcludes(() => profileStore.read(workspace.current() ?? "")?.rag?.excludes ?? []);
  updater.init();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
