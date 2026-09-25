import { contextBridge, ipcRenderer } from "electron";
import type { ChatStreamEvent } from "../shared/chat-events";
import type { ExplorerFile, ExplorerTreeResult } from "../shared/explorer";
import type { HarnessSettings } from "../shared/settings";
import type { CostSnapshot } from "../shared/cost";
import type { DreamNotification } from "../shared/dream";

export interface WindowControlsBridge {
  minimize: () => Promise<void>;
  maximizeOrRestore: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

export interface ExplorerBridge {
  getTree: () => Promise<ExplorerTreeResult>;
  readFile: (path: string) => Promise<ExplorerFile | { error: string }>;
  onChanged: (cb: (payload: { paths: string[]; ts: number }) => void) => () => void;
}

export interface TerminalBridge {
  start: () => Promise<{ cwd: string; banner: string }>;
  write: (line: string) => Promise<{ ok?: boolean; error?: string }>;
  onData: (cb: (payload: { data: string }) => void) => () => void;
}

export interface SettingsBridge {
  get: () => Promise<HarnessSettings>;
  update: (settings: HarnessSettings) => Promise<HarnessSettings | { error: string }>;
  resolved: () => Promise<{ provider: string; model: string; usingMock: boolean; configPath: string }>;
  testProvider: () => Promise<{ ok: boolean; reason: string }>;
  onChanged: (cb: (settings: HarnessSettings) => void) => () => void;
}

export interface PlanBridge {
  approve: (sessionId: string, markdown: string) => Promise<{ ok: boolean }>;
  discard: (sessionId: string) => Promise<{ ok: boolean }>;
  revise: (sessionId: string, markdown: string) => Promise<{ ok: boolean }>;
}

export interface CostBridge {
  get: () => Promise<CostSnapshot>;
  onUpdated: (cb: (snapshot: CostSnapshot) => void) => () => void;
}

export interface DreamBridge {
  onLearned: (cb: (notification: DreamNotification) => void) => () => void;
}

export interface SendMessageOptions {
  sessionId?: string;
  bypassHarness?: boolean;
}

export interface HarnessBridge {
  ping: () => Promise<{ status: string; version: string }>;
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<Record<string, unknown>>;
  getSessions: () => Promise<{ sessions: unknown[] }>;
  health: () => Promise<{ status: string; ts: number }>;
  onEvent: (cb: (event: unknown) => void) => () => void;
  onChatEvent: (cb: (event: ChatStreamEvent) => void) => () => void;
  explorer: ExplorerBridge;
  terminal: TerminalBridge;
  settings: SettingsBridge;
  plan: PlanBridge;
  cost: CostBridge;
  dream: DreamBridge;
  windowControls: WindowControlsBridge;
}

const windowControls: WindowControlsBridge = {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximizeOrRestore: () => ipcRenderer.invoke("window:maximizeOrRestore"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized")
};

const explorer: ExplorerBridge = {
  getTree: () => ipcRenderer.invoke("explorer:getTree"),
  readFile: (path: string) => ipcRenderer.invoke("explorer:readFile", path),
  onChanged: (cb) => {
    const handler = (_e: unknown, payload: { paths: string[]; ts: number }) => cb(payload);
    ipcRenderer.on("explorer:changed", handler as never);
    return () => ipcRenderer.removeListener("explorer:changed", handler as never);
  }
};

const terminal: TerminalBridge = {
  start: () => ipcRenderer.invoke("terminal:start"),
  write: (line: string) => ipcRenderer.invoke("terminal:write", line),
  onData: (cb) => {
    const handler = (_e: unknown, payload: { data: string }) => cb(payload);
    ipcRenderer.on("terminal:data", handler as never);
    return () => ipcRenderer.removeListener("terminal:data", handler as never);
  }
};

const settings: SettingsBridge = {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (next: HarnessSettings) => ipcRenderer.invoke("settings:update", next),
  resolved: () => ipcRenderer.invoke("settings:resolved"),
  testProvider: () => ipcRenderer.invoke("settings:testProvider"),
  onChanged: (cb) => {
    const handler = (_e: unknown, next: HarnessSettings) => cb(next);
    ipcRenderer.on("settings:changed", handler as never);
    return () => ipcRenderer.removeListener("settings:changed", handler as never);
  }
};

const plan: PlanBridge = {
  approve: (sessionId: string, markdown: string) => ipcRenderer.invoke("plan:decide", { sessionId, action: "approve", markdown }),
  discard: (sessionId: string) => ipcRenderer.invoke("plan:decide", { sessionId, action: "discard" }),
  revise: (sessionId: string, markdown: string) => ipcRenderer.invoke("plan:revise", { sessionId, markdown })
};

const cost: CostBridge = {
  get: () => ipcRenderer.invoke("cost:get"),
  onUpdated: (cb) => {
    const handler = (_e: unknown, snapshot: CostSnapshot) => cb(snapshot);
    ipcRenderer.on("cost:updated", handler as never);
    return () => ipcRenderer.removeListener("cost:updated", handler as never);
  }
};

const dream: DreamBridge = {
  onLearned: (cb) => {
    const handler = (_e: unknown, notification: DreamNotification) => cb(notification);
    ipcRenderer.on("dream:learned", handler as never);
    return () => ipcRenderer.removeListener("dream:learned", handler as never);
  }
};

const harness: HarnessBridge = {
  ping: () => ipcRenderer.invoke("harness:ping"),
  sendMessage: (message: string, options?: SendMessageOptions) =>
    ipcRenderer.invoke("harness:sendMessage", { message, ...options }),
  getSessions: () => ipcRenderer.invoke("harness:getSessions"),
  health: () => ipcRenderer.invoke("harness:health"),
  onEvent: (cb) => {
    const handler = (_e: unknown, data: unknown) => cb(data);
    ipcRenderer.on("harness:event", handler as never);
    return () => ipcRenderer.removeListener("harness:event", handler as never);
  },
  onChatEvent: (cb) => {
    const handler = (_e: unknown, data: unknown) => cb(data as ChatStreamEvent);
    ipcRenderer.on("harness:chat", handler as never);
    return () => ipcRenderer.removeListener("harness:chat", handler as never);
  },
  explorer,
  terminal,
  settings,
  plan,
  cost,
  dream,
  windowControls
};

contextBridge.exposeInMainWorld("harness", harness);

declare global {
  interface Window {
    harness?: HarnessBridge;
  }
}
