import { describe, it, expect } from "vitest";
import {
  INITIAL_PANEL_STATE,
  PANEL_WIDTHS,
  TERMINAL_LIMITS,
  actionForShortcut,
  clampTerminalHeight,
  cycleDockTab,
  panelReducer,
} from "../panel-state";

describe("Panel layout state", () => {
  it("starts with the dock open on Explorer, palette closed, no preview and terminal closed", () => {
    expect(INITIAL_PANEL_STATE).toEqual({
      dockOpen: true,
      dockTab: "explorer",
      paletteOpen: false,
      previewPath: null,
      terminalOpen: false,
      terminalHeight: 220,
      settingsOpen: false,
      sessionsOpen: false,
    });
  });

  it("toggles the dock per tab: reopen on the same tab closes it", () => {
    const closed = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-explorer" });
    expect(closed.dockOpen).toBe(false);
    expect(closed.dockTab).toBe("explorer");

    const contextOpen = panelReducer(closed, { type: "toggle-context" });
    expect(contextOpen.dockOpen).toBe(true);
    expect(contextOpen.dockTab).toBe("context");

    const contextClosed = panelReducer(contextOpen, { type: "toggle-context" });
    expect(contextClosed.dockOpen).toBe(false);
  });

  it("selects a dock tab without closing an open dock", () => {
    const onContext = panelReducer(INITIAL_PANEL_STATE, { type: "select-dock-tab", tab: "context" });
    expect(onContext).toMatchObject({ dockOpen: true, dockTab: "context" });
    const reopened = panelReducer({ ...INITIAL_PANEL_STATE, dockOpen: false }, { type: "select-dock-tab", tab: "explorer" });
    expect(reopened).toMatchObject({ dockOpen: true, dockTab: "explorer" });
  });

  it("cycles dock tabs for roving focus", () => {
    expect(cycleDockTab("explorer", 1)).toBe("context");
    expect(cycleDockTab("context", 1)).toBe("explorer");
    expect(cycleDockTab("explorer", -1)).toBe("context");
  });

  it("opens and closes the palette", () => {
    const opened = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-palette" });
    expect(opened.paletteOpen).toBe(true);
    const closed = panelReducer(opened, { type: "close-palette" });
    expect(closed.paletteOpen).toBe(false);
  });

  it("opens a preview (closing the palette) and closes it", () => {
    const withPalette = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-palette" });
    const withPreview = panelReducer(withPalette, { type: "open-preview", path: "src/a.ts" });
    expect(withPreview.previewPath).toBe("src/a.ts");
    expect(withPreview.paletteOpen).toBe(false);
    const closed = panelReducer(withPreview, { type: "close-preview" });
    expect(closed.previewPath).toBeNull();
  });

  it("toggles the terminal and clamps its height", () => {
    const opened = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-terminal" });
    expect(opened.terminalOpen).toBe(true);
    const grown = panelReducer(opened, { type: "set-terminal-height", height: 9999 });
    expect(grown.terminalHeight).toBe(TERMINAL_LIMITS.max);
    const shrunk = panelReducer(grown, { type: "set-terminal-height", height: 10 });
    expect(shrunk.terminalHeight).toBe(TERMINAL_LIMITS.min);
    expect(clampTerminalHeight(300)).toBe(300);
  });

  it("opens settings (closing the palette) and closes it", () => {
    const withPalette = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-palette" });
    const opened = panelReducer(withPalette, { type: "open-settings" });
    expect(opened.settingsOpen).toBe(true);
    expect(opened.paletteOpen).toBe(false);
    const closed = panelReducer(opened, { type: "close-settings" });
    expect(closed.settingsOpen).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const next = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-explorer" });
    expect(INITIAL_PANEL_STATE.dockOpen).toBe(true);
    expect(next).not.toBe(INITIAL_PANEL_STATE);
  });

  it("maps shortcuts to actions and keeps the canonical dock width", () => {
    expect(actionForShortcut("toggle-explorer")).toEqual({ type: "toggle-explorer" });
    expect(actionForShortcut("toggle-context")).toEqual({ type: "toggle-context" });
    expect(actionForShortcut("command-palette")).toEqual({ type: "toggle-palette" });
    expect(actionForShortcut("search-files")).toEqual({ type: "toggle-palette" });
    expect(actionForShortcut("toggle-terminal")).toEqual({ type: "toggle-terminal" });
    expect(actionForShortcut("open-settings")).toEqual({ type: "open-settings" });
    expect(PANEL_WIDTHS).toEqual({ dock: 340 });
  });
});
