import { cn } from "../lib/cn";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { PANEL_WIDTHS } from "../shell/panel-state";

interface ShellLayoutProps {
  explorerOpen: boolean;
  contextOpen: boolean;
}

export function ShellLayout({ explorerOpen, contextOpen }: ShellLayoutProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        aria-label="Explorer"
        aria-hidden={!explorerOpen}
        className={cn("panel-anim shrink-0 overflow-hidden", explorerOpen ? "border-r border-hairline" : "border-r-0")}
        style={{ width: explorerOpen ? PANEL_WIDTHS.explorer : 0 }}
      >
        <div className="h-full" style={{ width: PANEL_WIDTHS.explorer }}>
          <ExplorerPanel />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <ChatPanel />
      </main>

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
