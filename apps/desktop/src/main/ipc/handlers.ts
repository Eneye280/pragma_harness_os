import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";
import { ingress } from "../harness/ingress";
import { runPipelineStub } from "../harness/pipeline/stub";
import { MemoryEventLog } from "../db/memory-event-log";
import { createChatService } from "../chat";
import { PlanController } from "../plan";
import { CustomPluginHost } from "../plugins/custom";
import { ToolApprovalBroker } from "../tools/approval-broker";
import { effectiveToolPermission } from "../../shared/settings";
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
  attachments: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        kind: z.enum(["image", "document"]),
        name: z.string().min(1).max(300),
        mime: z.string().max(120),
        size: z.number().nonnegative(),
        dataUrl: z.string().max(8_000_000).optional(),
        text: z.string().max(200_000).optional(),
        description: z.string().max(2000).optional(),
      })
    )
    .max(10)
    .optional(),
});
const pingResponse = { status: "harness:ready" as const, version: "0.1.0" };

const memoryLog = new MemoryEventLog();

interface ActiveRun {
  controller: AbortController;
  steer: string[];
}

const activeRuns = new Map<string, ActiveRun>();

function pollSteer(sessionId: string): string | null {
  const run = activeRuns.get(sessionId);
  if (!run) return null;
  return run.steer.shift() ?? null;
}

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  settingsController: SettingsController,
  costTracker: CostTracker,
  workspace: WorkspaceFolderController
): void {
  const planController = new PlanController();
  const customPluginHost = new CustomPluginHost(() => workspace.current());
  const toolApprovalBroker = new ToolApprovalBroker();
  const chatService = createChatService(
    settingsController,
    costTracker,
    planController,
    (snapshot) => {
      const win = getMainWindow();
      if (win) win.webContents.send("cost:updated", snapshot);
    },
    () => workspace.current(),
    pollSteer,
    () => customPluginHost.load(),
    {
      resolvePermission: (tool) => effectiveToolPermission(tool, settingsController.store.get().tools),
      requestApproval: (request) => toolApprovalBroker.register(request.callId, request.tool),
    }
  );

  ipcMain.handle("harness:approveTool", async (_event, rawPayload: unknown) => {
    const payload = z
      .object({
        callId: z.string().min(1),
        tool: z.enum(["fileRead", "fileEdit", "terminal", "mcp_call"]),
        decision: z.enum(["approve", "reject"]),
        remember: z.boolean().optional(),
      })
      .safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid tool approval" };
    const resolved = toolApprovalBroker.resolve(payload.data.callId, { approved: payload.data.decision === "approve" });
    if (!resolved) return { ok: false, error: "no pending approval" };
    if (payload.data.remember) {
      const tools = settingsController.store.get().tools;
      settingsController.store.updateTools({
        ...tools,
        perTool: { ...tools.perTool, [payload.data.tool]: payload.data.decision === "approve" ? "allow" : "deny" },
      });
    }
    memoryLog.append({
      type: "agent:tool-approval",
      payload: { tool: payload.data.tool, decision: payload.data.decision, remember: payload.data.remember ?? false },
      sessionId: "tool-approval",
      workspaceHash: workspace.current() ?? "unknown",
    });
    return { ok: true };
  });

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
    const ok = action === "discard" ? planController.decide(sessionId, { action: "discard" }) : planController.decide(sessionId, { action: "approve", markdown: markdown ?? "" });
    if (ok) {
      memoryLog.append({
        type: "plan:decision",
        payload: { action, partial: action === "approve" ? /Aprobación parcial/.test(markdown ?? "") : false },
        sessionId,
        workspaceHash: workspace.current() ?? "unknown",
      });
    }
    return { ok };
  });

  ipcMain.handle("plan:revise", async (_event, rawPayload: unknown) => {
    const payload = z.object({ sessionId: z.string().min(1), markdown: z.string() }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid plan revision" };
    return { ok: planController.revise(payload.data.sessionId, payload.data.markdown) };
  });
  ipcMain.handle("harness:ping", async () => pingResponse);

  ipcMain.handle("harness:cancel", async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string") return { ok: false };
    const run = activeRuns.get(sessionId);
    if (!run) return { ok: false };
    run.controller.abort();
    return { ok: true };
  });

  ipcMain.handle("harness:steer", async (_event, rawPayload: unknown) => {
    const payload = rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;
    if (!payload || typeof payload.sessionId !== "string" || typeof payload.text !== "string") {
      return { ok: false };
    }
    const run = activeRuns.get(payload.sessionId);
    if (!run) return { ok: false };
    const text = payload.text.trim();
    if (!text) return { ok: false };
    run.steer.push(text);
    return { ok: true };
  });

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

    const controller = new AbortController();
    activeRuns.set(context.sessionId, { controller, steer: [] });

    void chatService
      .run(
        {
          message: context.normalized,
          sessionId: context.sessionId,
          workspacePath: context.workspacePath,
          bypassHarness: parsed.data.bypassHarness,
          attachments: parsed.data.attachments,
        },
        (chatEvent) => {
          const targetWindow = getMainWindow();
          if (targetWindow) targetWindow.webContents.send("harness:chat", chatEvent);
        },
        { signal: controller.signal }
      )
      .finally(() => {
        activeRuns.delete(context.sessionId);
        dreamingScheduler.schedule();
      });

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
