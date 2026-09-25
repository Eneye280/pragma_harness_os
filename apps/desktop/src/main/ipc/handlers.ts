import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";
import { ingress } from "../harness/ingress";
import { runPipelineStub } from "../harness/pipeline/stub";
import { MemoryEventLog } from "../db/memory-event-log";
import { createChatService } from "../chat";
import { PlanController } from "../plan";
import { DreamingScheduler } from "../dreaming";
import { vault } from "../memory/vault";
import { AgentGateway } from "../llm/gateway";
import { CORRECTION_PATTERN, extractCorrectionTrigger } from "../../shared/dream";
import type { SettingsController } from "../settings";
import type { CostTracker } from "../cost";
import type { WorkspaceFolderController } from "../workspace-folder";

function buildAnalyzer(settingsController: SettingsController) {
  return async (candidate: { kind: string; trigger: string; content: string; count: number }): Promise<string> => {
    const settings = settingsController.store.get();
    if (settings.provider.provider === "mock" || !settings.provider.apiKey) return candidate.content;
    try {
      const gateway = new AgentGateway({
        provider: settings.provider.provider,
        apiKey: settings.provider.apiKey,
        baseURL: settings.provider.baseURL || undefined,
        model: settings.provider.models.classifier,
      });
      const summary = await gateway.collect(
        `Resume en una frase accionable este aprendizaje detectado por el harness (kind=${candidate.kind}, repeticiones=${candidate.count}). Sé conciso, sin rodeos.\n${candidate.content}`
      );
      return summary.trim() || candidate.content;
    } catch {
      return candidate.content;
    }
  };
}

const sendMessageSchema = z.object({
  message: z.string().min(1).max(20000),
  sessionId: z.string().min(1).max(120).optional(),
  bypassHarness: z.boolean().optional(),
});
const pingResponse = { status: "harness:ready" as const, version: "0.1.0" };

const memoryLog = new MemoryEventLog();

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  settingsController: SettingsController,
  costTracker: CostTracker,
  workspace: WorkspaceFolderController
): void {
  const planController = new PlanController();
  const chatService = createChatService(
    settingsController,
    costTracker,
    planController,
    (snapshot) => {
      const win = getMainWindow();
      if (win) win.webContents.send("cost:updated", snapshot);
    },
    () => workspace.current()
  );

  ipcMain.handle("cost:get", async () => {
    const settings = settingsController.store.get();
    return costTracker.snapshot({ tokensPerDay: settings.budget.tokensPerDay, usdPerDay: settings.budget.usdPerDay });
  });

  const dreamingScheduler = new DreamingScheduler({
    getEvents: () => memoryLog.allEvents(),
    workspacePath: () => workspace.current(),
    deps: { addInstinct: (workspacePath, data) => vault.addInstinct(workspacePath, data), analyze: buildAnalyzer(settingsController) },
    onLearned: (results) => {
      const win = getMainWindow();
      if (!win) return;
      const workspaceHash = workspace.current();
      for (const result of results) {
        win.webContents.send("dream:learned", { ...result, workspaceHash, ts: Date.now() });
      }
    },
  });
  dreamingScheduler.start();

  ipcMain.handle("plan:decide", async (_event, rawPayload: unknown) => {
    const payload = z
      .object({ sessionId: z.string().min(1), action: z.enum(["approve", "discard"]), markdown: z.string().optional() })
      .safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid plan decision" };
    const { sessionId, action, markdown } = payload.data;
    if (action === "discard") return { ok: planController.decide(sessionId, { action: "discard" }) };
    return { ok: planController.decide(sessionId, { action: "approve", markdown: markdown ?? "" }) };
  });

  ipcMain.handle("plan:revise", async (_event, rawPayload: unknown) => {
    const payload = z.object({ sessionId: z.string().min(1), markdown: z.string() }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid plan revision" };
    return { ok: planController.revise(payload.data.sessionId, payload.data.markdown) };
  });
  ipcMain.handle("harness:ping", async () => pingResponse);

  ipcMain.handle("harness:sendMessage", async (_e, rawMessage: unknown) => {
    const parsed = sendMessageSchema.safeParse(
      typeof rawMessage === "string" ? { message: rawMessage } : rawMessage
    );
    if (!parsed.success) {
      return { error: "Invalid message", details: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const { context, eventId } = ingress.intercept(parsed.data.message, {
      sessionId: parsed.data.sessionId,
      workspacePath: workspace.current(),
    });
    const harnessEvent = ingress.createHarnessEvent(context, eventId);

    memoryLog.ensureWorkspace(context.workspaceHash, context.workspacePath);
    memoryLog.append({
      type: harnessEvent.type,
      payload: harnessEvent.payload,
      sessionId: harnessEvent.sessionId,
      workspaceHash: harnessEvent.workspaceHash,
      id: harnessEvent.id,
      ts: harnessEvent.ts,
    });

    const pipeline = await runPipelineStub(context);

    if (CORRECTION_PATTERN.test(context.normalized)) {
      memoryLog.append({
        type: "harness:memory-write",
        payload: {
          kind: "correction",
          trigger: extractCorrectionTrigger(context.normalized),
          content: context.normalized,
          domain: "general",
        },
        sessionId: context.sessionId,
        workspaceHash: context.workspaceHash,
      });
    }

    const win = getMainWindow();
    if (win) win.webContents.send("harness:event", harnessEvent);

    void chatService.run(
      {
        message: context.normalized,
        sessionId: context.sessionId,
        workspacePath: context.workspacePath,
        bypassHarness: parsed.data.bypassHarness,
      },
      (chatEvent) => {
        const targetWindow = getMainWindow();
        if (targetWindow) targetWindow.webContents.send("harness:chat", chatEvent);
      }
    ).finally(() => dreamingScheduler.schedule());

    return {
      received: context.normalized,
      sessionId: context.sessionId,
      workspaceHash: context.workspaceHash,
      eventId: harnessEvent.id,
      commands: context.commands,
      mentions: context.mentions,
      pipeline,
      note: "chat service streaming — harness events + agent deltas",
      ts: context.timestamp,
    };
  });

  ipcMain.handle("harness:getSessions", async (_e, sessionId: unknown) => {
    if (typeof sessionId === "string") return { events: memoryLog.getBySession(sessionId) };
    return { sessions: [] };
  });

  ipcMain.handle("harness:health", async () => ({ status: "ok", ts: Date.now() }));
  ipcMain.handle("harness:getEvents", async (_e, sessionId: unknown) => {
    if (typeof sessionId === "string") return { events: memoryLog.getBySession(sessionId) };
    return { events: [] };
  });
}

export function broadcastEvent(event: unknown): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send("harness:event", event);
}
