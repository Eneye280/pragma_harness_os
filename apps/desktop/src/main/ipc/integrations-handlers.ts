import { ipcMain } from "electron";
import { z } from "zod";
import { testSupabase } from "../integrations/supabase";
import type { SettingsController } from "../settings";

export function registerIntegrationsHandlers(settingsController: SettingsController): void {
  ipcMain.handle("integrations:get", async () => {
    const integrations = settingsController.store.get().integrations;
    return {
      supabase: { url: integrations.supabase.url, enabled: integrations.supabase.enabled, hasKey: integrations.supabase.anonKey.length > 0 },
      mcpServers: integrations.mcpServers,
    };
  });

  ipcMain.handle("integrations:test", async (_event, rawPayload: unknown) => {
    const payload = z.object({ provider: z.literal("supabase") }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, detail: "provider no soportado" };
    const supabase = settingsController.store.get().integrations.supabase;
    return testSupabase({ url: supabase.url, anonKey: supabase.anonKey });
  });
}
