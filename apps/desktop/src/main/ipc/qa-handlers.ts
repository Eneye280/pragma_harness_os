import { ipcMain } from "electron";
import { HEALTH_SCENARIO, runScenario, validateScenario, type QaScenario } from "../../shared/qa";
import { runProjectQa } from "../qa/project-qa";
import type { WorkspaceFolderController } from "../workspace-folder";

const BUILTIN_SCENARIOS: QaScenario[] = [HEALTH_SCENARIO];

export function registerQaHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("qa:scenarios", async () => ({ scenarios: BUILTIN_SCENARIOS }));

  ipcMain.handle("qa:run", async (_event, rawScenario: unknown) => {
    const scenario = (rawScenario as QaScenario) ?? HEALTH_SCENARIO;
    const validation = validateScenario(scenario);
    if (!validation.ok) return { ok: false, errors: validation.errors, result: null };
    return { ok: true, errors: [], result: await runScenario(scenario) };
  });

  ipcMain.handle("qa:verifyProject", async () => {
    return runProjectQa(workspace.current());
  });
}
