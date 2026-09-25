import type { ShellShortcut } from "./shortcuts";

export interface PanelState {
  explorerOpen: boolean;
  contextOpen: boolean;
  paletteOpen: boolean;
  previewPath: string | null;
}

export type PanelAction =
  | { type: "toggle-explorer" }
  | { type: "toggle-context" }
  | { type: "toggle-palette" }
  | { type: "close-palette" }
  | { type: "open-preview"; path: string }
  | { type: "close-preview" };

export const INITIAL_PANEL_STATE: PanelState = {
  explorerOpen: true,
  contextOpen: true,
  paletteOpen: false,
  previewPath: null,
};

export const PANEL_WIDTHS = { explorer: 260, context: 320 } as const;

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
  }
}

export function actionForShortcut(shortcut: ShellShortcut): PanelAction {
  switch (shortcut) {
    case "toggle-explorer":
      return { type: "toggle-explorer" };
    case "toggle-context":
      return { type: "toggle-context" };
    case "command-palette":
    case "search-files":
      return { type: "toggle-palette" };
  }
}
