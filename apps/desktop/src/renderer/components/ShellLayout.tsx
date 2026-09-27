import { useRef } from "react";
import type { ExplorerFile } from "@shared/explorer";
import type { SessionSummary } from "@shared/session";
import { cn } from "../lib/cn";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { CodePreview } from "../explorer/CodePreview";
import type { UseChatResult } from "../chat/use-chat";
import type { UseExplorerResult } from "../explorer/use-explorer";
import { DOCK_TAB_LABEL, PANEL_WIDTHS, cycleDockTab, type DockTab } from "../shell/panel-state";
import { TerminalPanel } from "./TerminalPanel";

interface ShellLayoutProps {
  dockOpen: boolean;
  dockTab: DockTab;
  onSelectDockTab: (tab: DockTab) => void;
  explorer: UseExplorerResult;
  chat: UseChatResult;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  previewFile: ExplorerFile | null;
  previewOpen: boolean;
  onClosePreview: () => void;
  terminalOpen: boolean;
  terminalHeight: number;
  onTerminalResize: (height: number) => void;
  onCloseTerminal: () => void;
  onOpenFolder: () => void;
  recents: string[];
  onPickRecent: (path: string) => void;
  openingFolder: boolean;
  activePath: string;
  sessions: SessionSummary[];
  currentSessionId: string;
  runningSessions: string[];
  onOpenSession: (id: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
}

export function ShellLayout({
  dockOpen,
  dockTab,
  onSelectDockTab,
  explorer,
  chat,
  selectedPath,
  onSelectFile,
  previewFile,
  previewOpen,
  onClosePreview,
  terminalOpen,
  terminalHeight,
  onTerminalResize,
  onCloseTerminal,
  onOpenFolder,
  recents,
  onPickRecent,
  openingFolder,
  activePath,
  sessions,
  currentSessionId,
  runningSessions,
  onOpenSession,
  onNewSession,
  onOpenSettings,
}: ShellLayoutProps): React.ReactElement {
  const tabRefs = useRef<Partial<Record<DockTab, HTMLButtonElement | null>>>({});

  function handleTabKeyDown(event: React.KeyboardEvent): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = cycleDockTab(dockTab, event.key === "ArrowRight" ? 1 : -1);
    onSelectDockTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 gap-2 p-2">
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-hidden rounded-sheet border border-hairline bg-surface/70 outline-none"
        >
          {previewOpen ? (
            <CodePreview file={previewFile} onClose={onClosePreview} />
          ) : (
            <ChatPanel chat={chat} workspacePath={activePath} onOpenFile={onSelectFile} />
          )}
        </main>

        <aside
          aria-label="Dock"
          aria-hidden={!dockOpen}
          inert={!dockOpen ? true : undefined}
          className={cn(
            "panel-anim shrink-0 overflow-hidden",
            dockOpen ? "glass-strong rounded-sheet" : "",
          )}
          style={{ width: dockOpen ? PANEL_WIDTHS.dock : 0 }}
        >
          <div className="flex h-full flex-col" style={{ width: PANEL_WIDTHS.dock }}>
            <div
              role="tablist"
              aria-label="Paneles laterales"
              onKeyDown={handleTabKeyDown}
              className="flex shrink-0 items-center gap-1 border-b border-hairline px-2 py-1.5"
            >
              {(["explorer", "context"] as const).map((tab) => (
                <DockTabButton
                  key={tab}
                  tab={tab}
                  active={dockTab === tab}
                  onSelect={onSelectDockTab}
                  buttonRef={(element) => {
                    tabRefs.current[tab] = element;
                  }}
                />
              ))}
            </div>

            <div
              id="dock-panel"
              role="tabpanel"
              aria-labelledby={`dock-tab-${dockTab}`}
              className="min-h-0 flex-1"
            >
              {dockTab === "explorer" ? (
                <ExplorerPanel
                  explorer={explorer}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onOpenFolder={onOpenFolder}
                  recents={recents}
                  onPickRecent={onPickRecent}
                  openingFolder={openingFolder}
                  activePath={activePath}
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  runningSessions={runningSessions}
                  onOpenSession={onOpenSession}
                  onNewSession={onNewSession}
                />
              ) : (
                <ContextPanel snapshot={chat.state.context} onOpenFile={onSelectFile} onOpenSettings={onOpenSettings} />
              )}
            </div>
          </div>
        </aside>
      </div>

      {terminalOpen ? (
        <TerminalPanel height={terminalHeight} onResize={onTerminalResize} onClose={onCloseTerminal} />
      ) : null}
    </div>
  );
}

function DockTabButton({
  tab,
  active,
  onSelect,
  buttonRef,
}: {
  tab: DockTab;
  active: boolean;
  onSelect: (tab: DockTab) => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}): React.ReactElement {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`dock-tab-${tab}`}
      aria-selected={active}
      aria-controls="dock-panel"
      aria-label={DOCK_TAB_LABEL[tab]}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(tab)}
      className={cn(
        "rounded-control px-2.5 py-1 text-[12px] outline-none transition-colors",
        active ? "bg-harness/15 text-harness-soft" : "text-zinc-400 hover:bg-surface-raised hover:text-zinc-200",
      )}
    >
      {DOCK_TAB_LABEL[tab]}
    </button>
  );
}
