import { describe, it, expect } from "vitest";
import { INITIAL_PANEL_STATE, PANEL_WIDTHS, actionForShortcut, panelReducer } from "../panel-state";

describe("Panel layout state", () => {
  it("starts with both side panels open, palette closed and no preview", () => {
    expect(INITIAL_PANEL_STATE).toEqual({ explorerOpen: true, contextOpen: true, paletteOpen: false, previewPath: null });
  });

  it("toggles explorer and context independently", () => {
    const explorerClosed = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-explorer" });
    expect(explorerClosed).toEqual({ explorerOpen: false, contextOpen: true, paletteOpen: false, previewPath: null });
    const contextClosed = panelReducer(explorerClosed, { type: "toggle-context" });
    expect(contextClosed).toEqual({ explorerOpen: false, contextOpen: false, paletteOpen: false, previewPath: null });
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

  it("does not mutate the previous state", () => {
    const next = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-explorer" });
    expect(INITIAL_PANEL_STATE.explorerOpen).toBe(true);
    expect(next).not.toBe(INITIAL_PANEL_STATE);
  });

  it("maps shortcuts to actions and keeps canonical panel widths", () => {
    expect(actionForShortcut("toggle-explorer")).toEqual({ type: "toggle-explorer" });
    expect(actionForShortcut("toggle-context")).toEqual({ type: "toggle-context" });
    expect(actionForShortcut("command-palette")).toEqual({ type: "toggle-palette" });
    expect(actionForShortcut("search-files")).toEqual({ type: "toggle-palette" });
    expect(PANEL_WIDTHS).toEqual({ explorer: 260, context: 320 });
  });
});
