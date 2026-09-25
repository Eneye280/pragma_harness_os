import { useCallback, useEffect, useReducer, useState } from "react";
import type { ExplorerFile } from "@shared/explorer";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { ShellLayout } from "./components/ShellLayout";
import { TitleBar } from "./components/TitleBar";
import { useExplorer } from "./explorer/use-explorer";
import { useChat } from "./chat/use-chat";
import { useCost } from "./cost/use-cost";
import { useDream } from "./dream/use-dream";
import { useSettings } from "./settings/use-settings";
import { INITIAL_PANEL_STATE, actionForShortcut, panelReducer } from "./shell/panel-state";
import { isEditableTarget, resolveShellShortcut } from "./shell/shortcuts";

export function App(): React.ReactElement {
  const [panels, dispatch] = useReducer(panelReducer, INITIAL_PANEL_STATE);
  const [status, setStatus] = useState("connecting…");
  const [previewFile, setPreviewFile] = useState<ExplorerFile | null>(null);
  const explorer = useExplorer();
  const chat = useChat();
  const cost = useCost();
  const dreamLearned = useDream();
  const settingsState = useSettings();

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
  const toggleTerminal = useCallback(() => dispatch({ type: "toggle-terminal" }), []);
  const closeTerminal = useCallback(() => dispatch({ type: "toggle-terminal" }), []);
  const resizeTerminal = useCallback(
    (height: number) => dispatch({ type: "set-terminal-height", height }),
    [],
  );
  const openSettings = useCallback(() => dispatch({ type: "open-settings" }), []);
  const closeSettings = useCallback(() => dispatch({ type: "close-settings" }), []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-zinc-100">
      <TitleBar
        status={status}
        cost={cost}
        onOpenPalette={openPalette}
        onToggleExplorer={toggleExplorer}
        onToggleContext={toggleContext}
        onToggleTerminal={toggleTerminal}
        onOpenSettings={openSettings}
      />
      <ShellLayout
        explorerOpen={panels.explorerOpen}
        contextOpen={panels.contextOpen}
        explorer={explorer}
        chat={chat}
        selectedPath={panels.previewPath}
        onSelectFile={openFile}
        previewFile={previewFile}
        previewOpen={Boolean(panels.previewPath)}
        onClosePreview={closePreview}
        terminalOpen={panels.terminalOpen}
        terminalHeight={panels.terminalHeight}
        onTerminalResize={resizeTerminal}
        onCloseTerminal={closeTerminal}
      />
      <CommandPalette
        open={panels.paletteOpen}
        onClose={closePalette}
        onToggleExplorer={toggleExplorer}
        onToggleContext={toggleContext}
        onOpenSettings={openSettings}
        files={explorer.files}
        onOpenFile={openFile}
      />
      <SettingsModal open={panels.settingsOpen} onClose={closeSettings} settingsState={settingsState} cost={cost} />

      {dreamLearned.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-12 z-40 flex w-[320px] flex-col gap-2">
          {dreamLearned.map((notification) => (
            <div
              key={`${notification.trigger}-${notification.ts}`}
              className="palette-anim rounded-panel border border-harness/40 bg-surface-raised px-3 py-2 shadow-xl shadow-black/50"
            >
              <p className="text-[11px] font-semibold text-harness-soft">New instinct learned</p>
              <p className="mt-0.5 text-[11px] text-zinc-300">{notification.content}</p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                {notification.trigger} · confidence {notification.confidence.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
