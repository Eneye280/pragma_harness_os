import { ipcMain } from "electron";
import { existsSync } from "fs";
import { collectDiagnostics, type DiagnosticsProbes } from "../diagnostics/health";
import { ragIndex } from "../harness/rag";
import { SandboxRunner } from "../sandbox";
import { skillCompiler } from "../harness/skills/skill-compiler";
import type { SettingsController } from "../settings";
import type { WorkspaceFolderController } from "../workspace-folder";

export interface DiagnosticsHandlerDeps {
  version: string;
  settingsController: SettingsController;
  workspace: WorkspaceFolderController;
  gitStatus: () => Promise<{ clean: boolean; detail: string }>;
  serverHealth: () => Promise<{ reachable: boolean; detail: string }>;
  sqliteAvailable: () => boolean;
}

export function registerDiagnosticsHandlers(deps: DiagnosticsHandlerDeps): void {
  const probes: DiagnosticsProbes = {
    version: () => deps.version,
    provider: () => {
      const settings = deps.settingsController.store.get();
      return {
        name: settings.provider.provider,
        hasKey: Boolean(settings.provider.apiKey),
        model: settings.provider.models.executor,
      };
    },
    sqlite: () => ({
      available: deps.sqliteAvailable(),
      detail: deps.sqliteAvailable() ? "better-sqlite3 cargado" : "ABI de Node: se usa persistencia JSON (esperado en dev)",
    }),
    server: () => deps.serverHealth(),
    docker: async () => {
      const runner = new SandboxRunner({ settings: { enabled: true } });
      const available = await runner.isDockerAvailable();
      return { available, detail: available ? "daemon accesible" : "daemon no disponible — el sandbox se niega a ejecutar fuera del contenedor" };
    },
    rag: () => ({ size: ragIndex.size, excludes: ragIndex.getExcludes().length }),
    git: () => deps.gitStatus(),
  };

  ipcMain.handle("diagnostics:get", async () => collectDiagnostics(probes));

  ipcMain.handle("diagnostics:repairRag", async () => {
    skillCompiler.clearCache();
    const size = await ragIndex.index().catch(() => ragIndex.size);
    return { ok: true, size };
  });

  ipcMain.handle("diagnostics:paths", async () => {
    const workspacePath = deps.workspace.current() ?? "";
    return {
      workspace: workspacePath,
      workspaceExists: workspacePath ? existsSync(workspacePath) : false,
    };
  });
}
