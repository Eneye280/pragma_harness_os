import type { ExplorerFile } from "@shared/explorer";
import { cn } from "../lib/cn";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { CodePreview } from "../explorer/CodePreview";
import { PlanCanvas } from "./PlanCanvas";
import type { UseChatResult } from "../chat/use-chat";
import type { UseExplorerResult } from "../explorer/use-explorer";
import { PANEL_WIDTHS } from "../shell/panel-state";
import { TerminalPanel } from "./TerminalPanel";

interface ShellLayoutProps {
  explorerOpen: boolean;
  contextOpen: boolean;
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
}

export function ShellLayout({
  explorerOpen,
  contextOpen,
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
}: ShellLayoutProps): React.ReactElement {
  const pendingPlan = chat.state.planStatus === "proposed" ? chat.state.plan : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 gap-2 p-2">
        <aside
          aria-label="Explorer"
          aria-hidden={!explorerOpen}
          inert={!explorerOpen ? true : undefined}
          className={cn(
            "panel-anim shrink-0 overflow-hidden",
            explorerOpen ? "glass-strong rounded-sheet" : "",
          )}
          style={{ width: explorerOpen ? PANEL_WIDTHS.explorer : 0 }}
        >
          <div className="h-full" style={{ width: PANEL_WIDTHS.explorer }}>
            <ExplorerPanel
              explorer={explorer}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onOpenFolder={onOpenFolder}
              recents={recents}
              onPickRecent={onPickRecent}
              openingFolder={openingFolder}
            />
          </div>
        </aside>

        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-hidden rounded-sheet border border-hairline bg-surface/70 outline-none"
        >
          {pendingPlan ? (
            <PlanCanvas
              plan={pendingPlan}
              onApprove={chat.approvePlan}
              onRevise={chat.revisePlan}
              onDiscard={chat.discardPlan}
            />
          ) : previewOpen ? (
            <CodePreview file={previewFile} onClose={onClosePreview} />
          ) : (
            <ChatPanel chat={chat} />
          )}
        </main>

        <aside
          aria-label="Context"
          aria-hidden={!contextOpen}
          inert={!contextOpen ? true : undefined}
          className={cn(
            "panel-anim shrink-0 overflow-hidden",
            contextOpen ? "glass-strong rounded-sheet" : "",
          )}
          style={{ width: contextOpen ? PANEL_WIDTHS.context : 0 }}
        >
          <div className="h-full" style={{ width: PANEL_WIDTHS.context }}>
            <ContextPanel snapshot={chat.state.context} onOpenFile={onSelectFile} />
          </div>
        </aside>
      </div>

      {terminalOpen ? (
        <TerminalPanel height={terminalHeight} onResize={onTerminalResize} onClose={onCloseTerminal} />
      ) : null}
    </div>
  );
}
