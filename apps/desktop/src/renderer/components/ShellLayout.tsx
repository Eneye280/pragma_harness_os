import type { ExplorerFile } from "@shared/explorer";
import { cn } from "../lib/cn";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { CodePreview } from "../explorer/CodePreview";
import type { UseExplorerResult } from "../explorer/use-explorer";
import { PANEL_WIDTHS } from "../shell/panel-state";

interface ShellLayoutProps {
  explorerOpen: boolean;
  contextOpen: boolean;
  explorer: UseExplorerResult;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  previewFile: ExplorerFile | null;
  previewOpen: boolean;
  onClosePreview: () => void;
}

export function ShellLayout({
  explorerOpen,
  contextOpen,
  explorer,
  selectedPath,
  onSelectFile,
  previewFile,
  previewOpen,
  onClosePreview,
}: ShellLayoutProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        aria-label="Explorer"
        aria-hidden={!explorerOpen}
        className={cn("panel-anim shrink-0 overflow-hidden", explorerOpen ? "border-r border-hairline" : "border-r-0")}
        style={{ width: explorerOpen ? PANEL_WIDTHS.explorer : 0 }}
      >
        <div className="h-full" style={{ width: PANEL_WIDTHS.explorer }}>
          <ExplorerPanel explorer={explorer} selectedPath={selectedPath} onSelectFile={onSelectFile} />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{previewOpen ? <CodePreview file={previewFile} onClose={onClosePreview} /> : <ChatPanel />}</main>

      <aside
        aria-label="Context"
        aria-hidden={!contextOpen}
        className={cn("panel-anim shrink-0 overflow-hidden", contextOpen ? "border-l border-hairline" : "border-l-0")}
        style={{ width: contextOpen ? PANEL_WIDTHS.context : 0 }}
      >
        <div className="h-full" style={{ width: PANEL_WIDTHS.context }}>
          <ContextPanel />
        </div>
      </aside>
    </div>
  );
}
