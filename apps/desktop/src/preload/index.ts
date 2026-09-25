import { contextBridge, ipcRenderer } from "electron";

export interface HarnessBridge {
  ping: () => Promise<{ status: string; version: string }>;
  sendMessage: (message: string) => Promise<{ received: string; note: string } | { error: string }>;
  getSessions: () => Promise<{ sessions: unknown[] }>;
  health: () => Promise<{ status: string; ts: number }>;
  onEvent: (cb: (event: unknown) => void) => () => void;
}

const harness: HarnessBridge = {
  ping: () => ipcRenderer.invoke("harness:ping"),
  sendMessage: (message: string) => ipcRenderer.invoke("harness:sendMessage", message),
  getSessions: () => ipcRenderer.invoke("harness:getSessions"),
  health: () => ipcRenderer.invoke("harness:health"),
  onEvent: (cb) => {
    const handler = (_e: unknown, data: unknown) => cb(data);
    ipcRenderer.on("harness:event", handler as never);
    return () => ipcRenderer.removeListener("harness:event", handler as never);
  }
};

contextBridge.exposeInMainWorld("harness", harness);

declare global {
  interface Window {
    harness: HarnessBridge;
  }
}
