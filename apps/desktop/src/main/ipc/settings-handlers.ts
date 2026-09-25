import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";
import { SettingsSchema } from "../settings/settings-store";
import type { SettingsController } from "../settings";
import type { ProjectProfileStore } from "../profile";
import type { WorkspaceFolderController } from "../workspace-folder";
import type { HarnessSettings } from "../../shared/settings";
import type { ProjectProfile } from "../../shared/profile";

export function registerSettingsHandlers(
  getMainWindow: () => BrowserWindow | null,
  controller: SettingsController,
  profileStore: ProjectProfileStore,
  workspace: WorkspaceFolderController
): void {
  ipcMain.handle("settings:get", async () => controller.get());

  ipcMain.handle("settings:update", async (_event, incoming: unknown) => {
    const result = SettingsSchema.safeParse(incoming);
    if (!result.success) {
      return { error: result.error.issues.map((issue) => issue.path.join(".")).join(", ") };
    }
    const saved = controller.update(result.data as HarnessSettings);
    const win = getMainWindow();
    if (win) win.webContents.send("settings:changed", saved);
    return saved;
  });

  ipcMain.handle("settings:resolved", async () => controller.resolved());
  ipcMain.handle("settings:testProvider", async () => controller.testProvider());

  ipcMain.handle("settings:writeProfile", async (_event, rawPayload: unknown) => {
    const parsed = z.object({ name: z.string().min(1).max(120).optional() }).safeParse(rawPayload ?? {});
    const globalSettings = controller.store.getGlobal();
    const profile: ProjectProfile = {
      name: parsed.success ? parsed.data.name : undefined,
      provider: {
        provider: globalSettings.provider.provider,
        baseURL: globalSettings.provider.baseURL,
        models: { ...globalSettings.provider.models },
      },
      budget: { ...globalSettings.budget },
      gates: { pre: { ...globalSettings.gates.pre }, post: { ...globalSettings.gates.post } },
      plugins: { ...globalSettings.plugins },
      skills: { ...globalSettings.skills },
      agent: globalSettings.agent,
      sandbox: { ...globalSettings.sandbox },
    };
    const info = profileStore.write(workspace.current(), profile);
    return { ok: true, profile: info };
  });

  ipcMain.handle("settings:clearProfile", async () => {
    const info = profileStore.clear(workspace.current());
    return { ok: true, profile: info };
  });
}
