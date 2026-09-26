import { contextBridge, ipcRenderer } from "electron";
import type { ChatStreamEvent } from "../shared/chat-events";
import type { ExplorerFile, ExplorerTreeResult } from "../shared/explorer";
import type { HarnessSettings, ResolvedSettings } from "../shared/settings";
import type { ProjectProfileInfo } from "../shared/profile";
import type { CostSnapshot } from "../shared/cost";
import type { DreamNotification } from "../shared/dream";
import type { UpdateStatus } from "../shared/updater";
import type { GitStatus } from "../shared/git";
import type { SkillSummary } from "../shared/skills";
import type { AgentSummary } from "../shared/agents";
import type { BundleSummary, BundleValidation, StackDetection } from "../shared/bundles";
import type { SessionRecord, SessionSummary } from "../shared/session";
import type { WorkspaceChangedPayload, WorkspacePickResult, WorkspaceState } from "../shared/workspace";

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
  resolved: () => Promise<ResolvedSettings>;
  testProvider: () => Promise<{ ok: boolean; reason: string }>;
  writeProfile: (name?: string) => Promise<{ ok: boolean; profile: ProjectProfileInfo }>;
  clearProfile: () => Promise<{ ok: boolean; profile: ProjectProfileInfo }>;
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

export interface UpdaterBridge {
  getStatus: () => Promise<UpdateStatus>;
  check: () => Promise<UpdateStatus>;
  download: () => Promise<UpdateStatus>;
  install: () => Promise<{ ok: boolean }>;
  onStatus: (cb: (status: UpdateStatus) => void) => () => void;
}

export interface WorkspaceBridge {
  get: () => Promise<WorkspaceState>;
  pick: () => Promise<WorkspacePickResult>;
  activate: (path: string) => Promise<{ ok: boolean; state: WorkspaceState; error?: string }>;
  onChanged: (cb: (payload: WorkspaceChangedPayload) => void) => () => void;
}

export interface GitBridge {
  status: () => Promise<GitStatus>;
}

export interface SkillsBridge {
  list: () => Promise<SkillSummary[]>;
  setEnabled: (name: string, enabled: boolean) => Promise<{ error: string | null; skills: SkillSummary[] }>;
}

export interface AgentsBridge {
  list: () => Promise<AgentSummary[]>;
  select: (id: string) => Promise<{ error: string | null; agents: AgentSummary[] }>;
}

export interface BundlesBridge {
  list: () => Promise<BundleSummary[]>;
  apply: (stack: string) => Promise<{ ok: boolean; error?: string; profile?: ProjectProfileInfo; validation?: BundleValidation }>;
  detect: () => Promise<StackDetection>;
  scaffold: (stack: string) => Promise<{ ok: boolean; error?: string; written?: boolean; path?: string }>;
}

export interface SessionsBridge {
  list: (workspacePath: string) => Promise<{ sessions: SessionSummary[] }>;
  latest: (workspacePath: string) => Promise<{ session: SessionRecord | null }>;
  get: (id: string) => Promise<{ session: SessionRecord | null }>;
  save: (input: { id: string; workspacePath: string; title?: string; messageCount?: number; state: unknown }) => Promise<{ error: string | null; session: SessionSummary }>;
  rename: (id: string, title: string) => Promise<{ error: string | null; session: SessionSummary | null }>;
  delete: (id: string) => Promise<{ error: string | null }>;
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
  cancel: (sessionId: string) => Promise<{ ok: boolean }>;
  steer: (sessionId: string, text: string) => Promise<{ ok: boolean }>;
  explorer: ExplorerBridge;
  terminal: TerminalBridge;
  settings: SettingsBridge;
  plan: PlanBridge;
  cost: CostBridge;
  dream: DreamBridge;
  updater: UpdaterBridge;
  workspace: WorkspaceBridge;
  git: GitBridge;
  skills: SkillsBridge;
  agents: AgentsBridge;
  bundles: BundlesBridge;
  sessions: SessionsBridge;
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
  writeProfile: (name?: string) => ipcRenderer.invoke("settings:writeProfile", { name }),
  clearProfile: () => ipcRenderer.invoke("settings:clearProfile"),
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

const updater: UpdaterBridge = {
  getStatus: () => ipcRenderer.invoke("updater:getStatus"),
  check: () => ipcRenderer.invoke("updater:check"),
  download: () => ipcRenderer.invoke("updater:download"),
  install: () => ipcRenderer.invoke("updater:install"),
  onStatus: (cb) => {
    const handler = (_e: unknown, status: UpdateStatus) => cb(status);
    ipcRenderer.on("updater:status", handler as never);
    return () => ipcRenderer.removeListener("updater:status", handler as never);
  }
};

const workspace: WorkspaceBridge = {
  get: () => ipcRenderer.invoke("workspace:get"),
  pick: () => ipcRenderer.invoke("workspace:pick"),
  activate: (path: string) => ipcRenderer.invoke("workspace:activate", path),
  onChanged: (cb) => {
    const handler = (_e: unknown, payload: WorkspaceChangedPayload) => cb(payload);
    ipcRenderer.on("workspace:changed", handler as never);
    return () => ipcRenderer.removeListener("workspace:changed", handler as never);
  }
};

const git: GitBridge = {
  status: () => ipcRenderer.invoke("git:status")
};

const skills: SkillsBridge = {
  list: () => ipcRenderer.invoke("skills:list"),
  setEnabled: (name: string, enabled: boolean) => ipcRenderer.invoke("skills:setEnabled", { name, enabled })
};

const agents: AgentsBridge = {
  list: () => ipcRenderer.invoke("agents:list"),
  select: (id: string) => ipcRenderer.invoke("agents:select", id)
};

const bundles: BundlesBridge = {
  list: () => ipcRenderer.invoke("bundles:list"),
  apply: (stack: string) => ipcRenderer.invoke("bundles:apply", stack),
  detect: () => ipcRenderer.invoke("bundles:detect"),
  scaffold: (stack: string) => ipcRenderer.invoke("bundles:scaffold", stack)
};

const sessions: SessionsBridge = {
  list: (workspacePath: string) => ipcRenderer.invoke("sessions:list", workspacePath),
  latest: (workspacePath: string) => ipcRenderer.invoke("sessions:latest", workspacePath),
  get: (id: string) => ipcRenderer.invoke("sessions:get", id),
  save: (input) => ipcRenderer.invoke("sessions:save", input),
  rename: (id: string, title: string) => ipcRenderer.invoke("sessions:rename", { id, title }),
  delete: (id: string) => ipcRenderer.invoke("sessions:delete", id)
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
  cancel: (sessionId: string) => ipcRenderer.invoke("harness:cancel", sessionId),
  steer: (sessionId: string, text: string) => ipcRenderer.invoke("harness:steer", { sessionId, text }),
  explorer,
  terminal,
  settings,
  plan,
  cost,
  dream,
  updater,
  workspace,
  git,
  skills,
  agents,
  bundles,
  sessions,
  windowControls
};

contextBridge.exposeInMainWorld("harness", harness);

declare global {
  interface Window {
    harness?: HarnessBridge;
  }
}
