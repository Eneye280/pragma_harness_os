import { ipcMain } from "electron";
import { HEALTH_SCENARIO, runScenario, validateScenario, type QaScenario } from "../../shared/qa";

const BUILTIN_SCENARIOS: QaScenario[] = [HEALTH_SCENARIO];

export function registerQaHandlers(): void {
  ipcMain.handle("qa:scenarios", async () => ({ scenarios: BUILTIN_SCENARIOS }));

  ipcMain.handle("qa:run", async (_event, rawScenario: unknown) => {
    const scenario = (rawScenario as QaScenario) ?? HEALTH_SCENARIO;
    const validation = validateScenario(scenario);
    if (!validation.ok) return { ok: false, errors: validation.errors, result: null };
    return { ok: true, errors: [], result: await runScenario(scenario) };
  });
}
