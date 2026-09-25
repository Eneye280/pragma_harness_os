import type { ShellShortcut } from "./shortcuts";

export interface PanelState {
  explorerOpen: boolean;
  contextOpen: boolean;
  paletteOpen: boolean;
  previewPath: string | null;
  terminalOpen: boolean;
  terminalHeight: number;
  settingsOpen: boolean;
}

export type PanelAction =
  | { type: "toggle-explorer" }
  | { type: "toggle-context" }
  | { type: "toggle-palette" }
  | { type: "close-palette" }
  | { type: "open-preview"; path: string }
  | { type: "close-preview" }
  | { type: "toggle-terminal" }
  | { type: "set-terminal-height"; height: number }
  | { type: "open-settings" }
  | { type: "close-settings" };

export const INITIAL_PANEL_STATE: PanelState = {
  explorerOpen: true,
  contextOpen: true,
  paletteOpen: false,
  previewPath: null,
  terminalOpen: false,
  terminalHeight: 220,
  settingsOpen: false,
};

export const PANEL_WIDTHS = { explorer: 260, context: 320 } as const;
export const TERMINAL_LIMITS = { min: 120, max: 560 } as const;

export function clampTerminalHeight(height: number): number {
  return Math.min(TERMINAL_LIMITS.max, Math.max(TERMINAL_LIMITS.min, Math.round(height)));
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "toggle-explorer":
      return { ...state, explorerOpen: !state.explorerOpen };
    case "toggle-context":
      return { ...state, contextOpen: !state.contextOpen };
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
  }
}
