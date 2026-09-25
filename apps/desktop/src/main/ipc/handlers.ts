import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";
import { ingress } from "../harness/ingress";
import { runPipelineStub } from "../harness/pipeline/stub";
import { MemoryEventLog } from "../db/memory-event-log";
import { createChatService } from "../chat";
import { resolveHarnessWorkspace } from "../workspace-path";
import { PlanController } from "../plan";
import type { SettingsController } from "../settings";
import type { CostTracker } from "../cost";

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
  costTracker: CostTracker
): void {
  const planController = new PlanController();
  const chatService = createChatService(settingsController, costTracker, planController, (snapshot) => {
    const win = getMainWindow();
    if (win) win.webContents.send("cost:updated", snapshot);
  });

  ipcMain.handle("cost:get", async () => {
    const settings = settingsController.store.get();
    return costTracker.snapshot({ tokensPerDay: settings.budget.tokensPerDay, usdPerDay: settings.budget.usdPerDay });
  });

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
      workspacePath: resolveHarnessWorkspace(),
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
    );

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
