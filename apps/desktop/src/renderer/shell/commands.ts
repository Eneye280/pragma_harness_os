export type CommandGroup = "run" | "project" | "panels" | "view" | "settings" | "appearance";

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: CommandGroup;
  keywords?: string;
  run: () => void;
}

export const COMMAND_GROUP_LABEL: Record<CommandGroup, string> = {
  run: "Ejecutar",
  project: "Proyecto",
  panels: "Paneles",
  view: "Vistas",
  settings: "Ajustes",
  appearance: "Apariencia",
};

export interface CommandDeps {
  onNewSession: () => void;
  onOpenFolder: () => void;
  onOpenSessions: () => void;
  onToggleExplorer: () => void;
  onToggleContext: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onOpenUsage: () => void;
  onOpenGraph: () => void;
  onOpenDiagnostics: () => void;
  onOpenHelp: () => void;
  onOpenNotifications: () => void;
  onTheme: (mode: "system" | "light" | "dark") => void;
}

export function buildCommands(deps: CommandDeps): PaletteCommand[] {
  return [
    { id: "new-session", label: "Nueva sesión", hint: "⌘N", group: "run", keywords: "chat conversacion empezar", run: deps.onNewSession },
    { id: "open-folder", label: "Abrir proyecto (carpeta)", group: "run", keywords: "workspace carpeta folder abrir", run: deps.onOpenFolder },
    { id: "sessions", label: "Sesiones y proyectos", hint: "⇧⌘H", group: "project", keywords: "historial proyectos", run: deps.onOpenSessions },
    { id: "toggle-explorer", label: "Mostrar u ocultar Explorer", hint: "⌘B", group: "panels", keywords: "panel izquierda archivos", run: deps.onToggleExplorer },
    { id: "toggle-context", label: "Mostrar u ocultar Context", hint: "⇧⌘C", group: "panels", keywords: "panel derecha contexto", run: deps.onToggleContext },
    { id: "toggle-terminal", label: "Mostrar u ocultar Terminal", hint: "⌘`", group: "panels", keywords: "consola shell", run: deps.onToggleTerminal },
    { id: "usage", label: "Abrir uso y coste", group: "view", keywords: "tokens usd telemetria metricas", run: deps.onOpenUsage },
    { id: "graph", label: "Abrir grafo de dependencias", group: "view", keywords: "dependencias imports", run: deps.onOpenGraph },
    { id: "health", label: "Abrir diagnóstico / health", group: "view", keywords: "estado salud diagnostico", run: deps.onOpenDiagnostics },
    { id: "notifications", label: "Abrir notificaciones", group: "view", keywords: "avisos centro", run: deps.onOpenNotifications },
    { id: "help", label: "Abrir centro de ayuda", group: "view", keywords: "docs tour guia", run: deps.onOpenHelp },
    { id: "settings", label: "Abrir Settings", hint: "⌘,", group: "settings", keywords: "config preferencias", run: deps.onOpenSettings },
    { id: "theme-dark", label: "Tema: oscuro", group: "appearance", keywords: "dark noche", run: () => deps.onTheme("dark") },
    { id: "theme-light", label: "Tema: claro", group: "appearance", keywords: "light dia", run: () => deps.onTheme("light") },
    { id: "theme-system", label: "Tema: seguir al sistema", group: "appearance", keywords: "auto sistema", run: () => deps.onTheme("system") },
  ];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function score(command: PaletteCommand, query: string): number {
  const haystack = normalize(`${command.label} ${command.keywords ?? ""}`);
  const needle = normalize(query);
  if (!needle) return 1;
  const index = haystack.indexOf(needle);
  if (index === -1) return 0;
  const startsWord = index === 0 || haystack[index - 1] === " ";
  return startsWord ? 3 : 1;
}

export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;
  return commands
    .map((command) => ({ command, value: score(command, normalized) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.command);
}
