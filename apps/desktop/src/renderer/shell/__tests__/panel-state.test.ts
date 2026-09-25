import { describe, it, expect } from "vitest";
import { INITIAL_PANEL_STATE, PANEL_WIDTHS, actionForShortcut, panelReducer } from "../panel-state";

describe("Panel layout state", () => {
  it("starts with both side panels open and palette closed", () => {
    expect(INITIAL_PANEL_STATE).toEqual({ explorerOpen: true, contextOpen: true, paletteOpen: false });
  });

  it("toggles explorer and context independently", () => {
    const explorerClosed = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-explorer" });
    expect(explorerClosed).toEqual({ explorerOpen: false, contextOpen: true, paletteOpen: false });
    const contextClosed = panelReducer(explorerClosed, { type: "toggle-context" });
    expect(contextClosed).toEqual({ explorerOpen: false, contextOpen: false, paletteOpen: false });
  });

  it("opens and closes the palette", () => {
    const opened = panelReducer(INITIAL_PANEL_STATE, { type: "toggle-palette" });
    expect(opened.paletteOpen).toBe(true);
    const closed = panelReducer(opened, { type: "close-palette" });
    expect(closed.paletteOpen).toBe(false);
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
    expect(PANEL_WIDTHS).toEqual({ explorer: 260, context: 320 });
  });
});
