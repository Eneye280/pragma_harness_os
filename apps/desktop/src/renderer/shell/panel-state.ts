import type { ShellShortcut } from "./shortcuts";

/** Pestañas del dock lateral derecho. */
export type DockTab = "explorer" | "context";

export const DOCK_TABS: DockTab[] = ["explorer", "context"];

export const DOCK_TAB_LABEL: Record<DockTab, string> = {
  explorer: "Explorer",
  context: "Context",
};

export interface PanelState {
  dockOpen: boolean;
  dockTab: DockTab;
  paletteOpen: boolean;
  previewPath: string | null;
  terminalOpen: boolean;
  terminalHeight: number;
  settingsOpen: boolean;
  sessionsOpen: boolean;
}

export type PanelAction =
  | { type: "toggle-dock"; tab?: DockTab }
  | { type: "select-dock-tab"; tab: DockTab }
  | { type: "toggle-explorer" }
  | { type: "toggle-context" }
  | { type: "toggle-palette" }
  | { type: "close-palette" }
  | { type: "open-preview"; path: string }
  | { type: "close-preview" }
  | { type: "toggle-terminal" }
  | { type: "set-terminal-height"; height: number }
  | { type: "open-settings" }
  | { type: "close-settings" }
  | { type: "toggle-sessions" }
  | { type: "close-sessions" };

export const INITIAL_PANEL_STATE: PanelState = {
  dockOpen: true,
  dockTab: "explorer",
  paletteOpen: false,
  previewPath: null,
  terminalOpen: false,
  terminalHeight: 220,
  settingsOpen: false,
  sessionsOpen: false,
};

export const PANEL_WIDTHS = { dock: 340 } as const;
export const DOCK_LIMITS = { min: 260, max: 520 } as const;
export const TERMINAL_LIMITS = { min: 120, max: 560 } as const;

export function clampTerminalHeight(height: number): number {
  return Math.min(TERMINAL_LIMITS.max, Math.max(TERMINAL_LIMITS.min, Math.round(height)));
}

/**
 * Alterna el dock en `tab`: si ya está abierto en ese tab, lo cierra; si no,
 * lo abre (o cambia de tab).
 */
function toggleDock(state: PanelState, tab: DockTab): PanelState {
  if (state.dockOpen && state.dockTab === tab) return { ...state, dockOpen: false };
  return { ...state, dockOpen: true, dockTab: tab };
}

/** Siguiente tab del dock al navegar con flechas (roving focus). */
export function cycleDockTab(current: DockTab, delta: number): DockTab {
  const index = DOCK_TABS.indexOf(current);
  const next = (index + delta + DOCK_TABS.length) % DOCK_TABS.length;
  return DOCK_TABS[next];
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "toggle-dock":
      return toggleDock(state, action.tab ?? state.dockTab);
    case "select-dock-tab":
      return { ...state, dockOpen: true, dockTab: action.tab };
    case "toggle-explorer":
      return toggleDock(state, "explorer");
    case "toggle-context":
      return toggleDock(state, "context");
    case "toggle-palette":
      return { ...state, paletteOpen: !state.paletteOpen };
    case "close-palette":
      return { ...state, paletteOpen: false };
    case "open-preview":
      return { ...state, previewPath: action.path, paletteOpen: false };
    case "close-preview":
      return { ...state, previewPath: null };
    case "toggle-terminal":
      return { ...state, terminalOpen: !state.terminalOpen };
    case "set-terminal-height":
      return { ...state, terminalHeight: clampTerminalHeight(action.height) };
    case "open-settings":
      return { ...state, settingsOpen: true, paletteOpen: false };
    case "close-settings":
      return { ...state, settingsOpen: false };
    case "toggle-sessions":
      return { ...state, sessionsOpen: !state.sessionsOpen, paletteOpen: false };
    case "close-sessions":
      return { ...state, sessionsOpen: false };
  }
}

export function actionForShortcut(shortcut: ShellShortcut): PanelAction {
  switch (shortcut) {
    case "toggle-explorer":
      return { type: "toggle-explorer" };
    case "toggle-context":
      return { type: "toggle-context" };
    case "toggle-terminal":
      return { type: "toggle-terminal" };
    case "open-settings":
      return { type: "open-settings" };
    case "command-palette":
    case "search-files":
      return { type: "toggle-palette" };
    case "session-history":
      return { type: "toggle-sessions" };
  }
}
