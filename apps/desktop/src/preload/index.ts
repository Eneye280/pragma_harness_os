import { contextBridge, ipcRenderer } from "electron";
import type { ChatStreamEvent } from "../shared/chat-events";

export interface WindowControlsBridge {
  minimize: () => Promise<void>;
  maximizeOrRestore: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
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
  windowControls: WindowControlsBridge;
}

const windowControls: WindowControlsBridge = {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximizeOrRestore: () => ipcRenderer.invoke("window:maximizeOrRestore"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized")
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
  windowControls
};

contextBridge.exposeInMainWorld("harness", harness);

declare global {
  interface Window {
    harness?: HarnessBridge;
  }
}
