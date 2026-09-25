import { useCallback, useEffect, useReducer, useState } from "react";
import type { ExplorerFile } from "@shared/explorer";
import { CommandPalette } from "./components/CommandPalette";
import { ShellLayout } from "./components/ShellLayout";
import { TitleBar } from "./components/TitleBar";
import { useExplorer } from "./explorer/use-explorer";
import { INITIAL_PANEL_STATE, actionForShortcut, panelReducer } from "./shell/panel-state";
import { isEditableTarget, resolveShellShortcut } from "./shell/shortcuts";

export function App(): React.ReactElement {
  const [panels, dispatch] = useReducer(panelReducer, INITIAL_PANEL_STATE);
  const [status, setStatus] = useState("connecting…");
  const [previewFile, setPreviewFile] = useState<ExplorerFile | null>(null);
  const explorer = useExplorer();

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) {
      setStatus("offline");
      return;
    }
    bridge
      .ping()
      .then((response) => setStatus(response.status.replace("harness:", "")))
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    const bridge = window.harness?.explorer;
    if (!panels.previewPath || !bridge) {
      setPreviewFile(null);
      return;
    }
    let cancelled = false;
    bridge
      .readFile(panels.previewPath)
      .then((result) => {
        if (!cancelled) setPreviewFile("error" in result ? null : result);
      })
      .catch(() => {
        if (!cancelled) setPreviewFile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [panels.previewPath]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const shortcut = resolveShellShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      if (!shortcut) return;
      const target = event.target as HTMLElement | null;
      const targetTag = typeof target?.tagName === "string" ? target.tagName : "";
      const typingInField = isEditableTarget(targetTag, Boolean(target?.isContentEditable));
      if (typingInField && shortcut !== "command-palette" && shortcut !== "search-files") return;
      event.preventDefault();
      dispatch(actionForShortcut(shortcut));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openPalette = useCallback(() => dispatch({ type: "toggle-palette" }), []);
  const closePalette = useCallback(() => dispatch({ type: "close-palette" }), []);
  const toggleExplorer = useCallback(() => dispatch({ type: "toggle-explorer" }), []);
  const toggleContext = useCallback(() => dispatch({ type: "toggle-context" }), []);
  const openFile = useCallback((path: string) => dispatch({ type: "open-preview", path }), []);
  const closePreview = useCallback(() => dispatch({ type: "close-preview" }), []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-zinc-100">
      <TitleBar
        status={status}
        onOpenPalette={openPalette}
        onToggleExplorer={toggleExplorer}
        onToggleContext={toggleContext}
      />
      <ShellLayout
        explorerOpen={panels.explorerOpen}
        contextOpen={panels.contextOpen}
        explorer={explorer}
        selectedPath={panels.previewPath}
        onSelectFile={openFile}
        previewFile={previewFile}
        previewOpen={Boolean(panels.previewPath)}
        onClosePreview={closePreview}
      />
      <CommandPalette
        open={panels.paletteOpen}
        onClose={closePalette}
        onToggleExplorer={toggleExplorer}
        onToggleContext={toggleContext}
        files={explorer.files}
        onOpenFile={openFile}
      />
    </div>
  );
}
