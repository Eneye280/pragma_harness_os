import { contextBridge, ipcRenderer } from "electron";
import type { ChatStreamEvent } from "../shared/chat-events";
import type { ExplorerFile, ExplorerTreeResult } from "../shared/explorer";

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
  windowControls
};

contextBridge.exposeInMainWorld("harness", harness);

declare global {
  interface Window {
    harness?: HarnessBridge;
  }
}
