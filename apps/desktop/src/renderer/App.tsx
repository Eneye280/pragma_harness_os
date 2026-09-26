import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { ExplorerFile } from "@shared/explorer";
import { CommandPalette } from "./components/CommandPalette";
import { buildCommands } from "./shell/commands";
import { OnboardingCard } from "./components/OnboardingCard";
import { SessionsPanel } from "./components/SessionsPanel";
import { GraphPanel } from "./components/GraphPanel";
import { HelpCenter } from "./components/HelpCenter";
import { TourOverlay } from "./components/TourOverlay";
import { UsageDashboard } from "./components/UsageDashboard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { NotificationCenter } from "./components/NotificationCenter";
import { useNotifications } from "./notifications/use-notifications";
import { useTheme } from "./theme/use-theme";
import { INITIAL_TOUR_STATE, TOUR_STEPS, loadTourState, saveTourState, startTour, type TourState } from "./shell/tour";
import { StackWizard } from "./components/StackWizard";
import { SettingsModal } from "./components/SettingsModal";
import { ShellLayout } from "./components/ShellLayout";
import { TitleBar } from "./components/TitleBar";
import { useExplorer } from "./explorer/use-explorer";
import { useChat } from "./chat/use-chat";
import { useCost } from "./cost/use-cost";
import { useDream } from "./dream/use-dream";
import { useSettings } from "./settings/use-settings";
import { useUpdater } from "./settings/use-updater";
import { useWorkspace } from "./workspace/use-workspace";
import { useGitStatus } from "./git/use-git-status";
import { useSkills } from "./skills/use-skills";
import { useAgents } from "./agents/use-agents";
import { useSessions } from "./sessions/use-sessions";
import { INITIAL_PANEL_STATE, actionForShortcut, panelReducer } from "./shell/panel-state";
import { isEditableTarget, resolveShellShortcut } from "./shell/shortcuts";
import { ONBOARDING_STORAGE_KEY, shouldShowOnboarding } from "./shell/onboarding";

export function App(): React.ReactElement {
  const [panels, dispatch] = useReducer(panelReducer, INITIAL_PANEL_STATE);
  const [status, setStatus] = useState("connecting…");
  const [previewFile, setPreviewFile] = useState<ExplorerFile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return shouldShowOnboarding(localStorage.getItem(ONBOARDING_STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const [stackWizardOpen, setStackWizardOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useNotifications();
  const theme = useTheme();
  const [tour, setTour] = useState<TourState>(() => {
    try {
      const loaded = loadTourState(window.localStorage);
      return loaded.seen.length === 0 ? { ...loaded, active: true } : loaded;
    } catch {
      return INITIAL_TOUR_STATE;
    }
  });
  const explorer = useExplorer();
  const cost = useCost();
  const dreamLearned = useDream();
  const settingsState = useSettings();
  const updater = useUpdater();
  const workspace = useWorkspace();
  const chat = useChat(workspace.active);
  const git = useGitStatus(workspace.active);
  const skillsState = useSkills(workspace.active);
  const agentsState = useAgents(workspace.active);
  const sessionsState = useSessions(workspace.active, chat.sessionId);

  useEffect(() => {
    const bridge = window.harness?.hotreload;
    if (!bridge) return;
    return bridge.onChanged((change) => {
      if (change.kinds.includes("skills")) skillsState.refresh();
      if (change.kinds.includes("agents")) agentsState.refresh();
    });
  }, [skillsState, agentsState]);
  const refreshSettings = settingsState.refresh;

  useEffect(() => {
    refreshSettings();
  }, [workspace.active, refreshSettings]);

  useEffect(() => {
    if (!workspace.active) {
      setStackWizardOpen(false);
      return;
    }
    const bridge = window.harness?.bundles;
    if (!bridge) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(`phs:stack-wizard:${workspace.active}`) === "done";
    } catch {
      dismissed = false;
    }
    if (dismissed) {
      setStackWizardOpen(false);
      return;
    }
    let cancelled = false;
    bridge
      .detect()
      .then((detection) => {
        if (!cancelled) setStackWizardOpen(detection.blank);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspace.active]);

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
  const openSessions = useCallback(() => dispatch({ type: "toggle-sessions" }), []);
  const closeSessions = useCallback(() => dispatch({ type: "close-sessions" }), []);
  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    } catch {
      // persistence is best-effort
    }
    setShowOnboarding(false);
  }, []);

  const dismissStackWizard = useCallback(() => {
    try {
      localStorage.setItem(`phs:stack-wizard:${workspace.active}`, "done");
    } catch {
      // persistence is best-effort
    }
    setStackWizardOpen(false);
  }, [workspace.active]);

  const handleStackApplied = useCallback(() => {
    try {
      localStorage.setItem(`phs:stack-wizard:${workspace.active}`, "done");
    } catch {
      // persistence is best-effort
    }
    setStackWizardOpen(false);
    settingsState.refresh();
    skillsState.refresh();
    agentsState.refresh();
  }, [workspace.active, settingsState, skillsState, agentsState]);

  const commands = useMemo(
    () =>
      buildCommands({
        onNewSession: () => chat.startNewSession(),
        onOpenFolder: () => void workspace.pick(),
        onOpenSessions: openSessions,
        onToggleExplorer: toggleExplorer,
        onToggleContext: toggleContext,
        onToggleTerminal: toggleTerminal,
        onOpenSettings: openSettings,
        onOpenUsage: () => setUsageOpen(true),
        onOpenGraph: () => setGraphOpen(true),
        onOpenDiagnostics: () => setDiagnosticsOpen(true),
        onOpenHelp: () => setHelpOpen(true),
        onOpenNotifications: () => setNotificationsOpen(true),
        onTheme: (mode) => theme.setMode(mode),
      }),
    [chat, workspace, openSessions, toggleExplorer, toggleContext, toggleTerminal, openSettings, theme],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-zinc-100">
      <a href="#main" className="skip-link">
        Saltar al chat
      </a>
      <TitleBar
        status={status}
        cost={cost}
        git={git.status}
        workspaceName={workspace.active ? (workspace.active.split(/[\\/]/).filter(Boolean).pop() ?? "workspace") : "Pragma Harness OS"}
        projectPath={workspace.active}
        onOpenPalette={openPalette}
        onToggleExplorer={toggleExplorer}
        onToggleContext={toggleContext}
        onToggleTerminal={toggleTerminal}
        onOpenSettings={openSettings}
        onOpenSessions={openSessions}
        onOpenGraph={() => setGraphOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenUsage={() => setUsageOpen(true)}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        unreadNotifications={notifications.unread}
        onOpenNotifications={() => setNotificationsOpen(true)}
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
        onOpenFolder={() => void workspace.pick()}
        recents={workspace.recents}
        onPickRecent={(path) => void workspace.activate(path)}
        openingFolder={workspace.busy}
        activePath={workspace.active}
        sessions={sessionsState.sessions}
        currentSessionId={chat.sessionId}
        runningSessions={chat.runningSessions}
        onOpenSession={(id) => void chat.openSession(id)}
        onNewSession={() => chat.startNewSession()}
        onOpenSettings={openSettings}
      />
      <CommandPalette
        open={panels.paletteOpen}
        onClose={closePalette}
        commands={commands}
        files={explorer.files}
        onOpenFile={openFile}
      />
      <SettingsModal
        open={panels.settingsOpen}
        onClose={closeSettings}
        settingsState={settingsState}
        cost={cost}
        updater={updater}
        skillsState={skillsState}
        agentsState={agentsState}
        themeMode={theme.mode}
        onThemeChange={theme.setMode}
      />

      {showOnboarding ? <OnboardingCard onDismiss={dismissOnboarding} /> : null}
      {stackWizardOpen ? <StackWizard onSkip={dismissStackWizard} onApplied={handleStackApplied} /> : null}

      <SessionsPanel
        open={panels.sessionsOpen}
        onClose={closeSessions}
        sessions={sessionsState.sessions}
        currentSessionId={chat.sessionId}
        loading={sessionsState.loading}
        runningSessions={chat.runningSessions}
        onOpen={(id) => {
          void chat.openSession(id);
          closeSessions();
        }}
        onNew={() => {
          chat.startNewSession();
          closeSessions();
        }}
        onRename={(id, title) => void sessionsState.rename(id, title)}
        onDelete={(id) => void sessionsState.remove(id)}
        onCancel={(id) => chat.cancel(id)}
        onRefresh={sessionsState.refresh}
      />

      <GraphPanel open={graphOpen} onClose={() => setGraphOpen(false)} storageKey={workspace.active} />

      <HelpCenter
        open={helpOpen}        onClose={() => setHelpOpen(false)}
        onOpenDoc={(doc) => {
          openFile(doc);
          setHelpOpen(false);
        }}
        onStartTour={() => {
          setTour((current) => startTour(current));
          setHelpOpen(false);
        }}
      />

      <UsageDashboard open={usageOpen} onClose={() => setUsageOpen(false)} />
      <DiagnosticsPanel open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <NotificationCenter
        toasts={notifications.toasts}
        notifications={notifications.notifications}
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onMarkAll={notifications.markAll}
        onMarkOne={notifications.markOne}
        onDismiss={notifications.dismiss}
      />

      {tour.active ? (
        <TourOverlay
          state={tour}
          steps={TOUR_STEPS}
          onChange={(next) => {
            setTour(next);
            try {
              saveTourState(window.localStorage, next);
            } catch {
              // storage unavailable
            }
          }}
        />
      ) : null}

      {dreamLearned.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-12 z-40 flex w-[320px] flex-col gap-2">
          {dreamLearned.map((notification) => (
            <div
              key={`${notification.trigger}-${notification.ts}`}
              className="palette-anim rounded-panel border border-harness/40 bg-surface-raised px-3 py-2 shadow-xl shadow-black/50"
            >
              <p className="text-[12px] font-semibold text-harness-soft">New instinct learned</p>
              <p className="mt-0.5 text-[12px] text-zinc-300">{notification.content}</p>
              <p className="mt-0.5 font-mono text-[12px] text-zinc-600">
                {notification.trigger} · confidence {notification.confidence.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
