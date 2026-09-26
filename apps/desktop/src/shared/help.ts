export interface HelpTopic {
  id: string;
  title: string;
  body: string;
  tags: string[];
  doc?: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "start",
    title: "Primeros pasos",
    body: "Abre una carpeta, escribe una petición y el harness clasifica, compila skills/contexto y recién entonces despierta al agente.",
    tags: ["onboarding", "inicio", "workspace", "carpeta"],
    doc: "docs/HANDBOOK.md",
  },
  {
    id: "sessions",
    title: "Sesiones y reanudar",
    body: "Cada workspace tiene sesiones persistentes. Abre el panel Sessions (Ctrl/Cmd+Shift+H) para reanudar, renombrar o borrar.",
    tags: ["sesiones", "historial", "reanudar"],
    doc: "docs/HANDBOOK.md",
  },
  {
    id: "plan",
    title: "Plan y aprobación",
    body: "Para trabajo de feature el harness propone un plan. Puedes editar pasos, reordenarlos y aprobar sólo un subconjunto.",
    tags: ["plan", "aprobar", "canvas"],
    doc: "docs/HANDBOOK.md",
  },
  {
    id: "tools",
    title: "Permisos de herramientas",
    body: "Con askBeforeTools el agente pide permiso antes de editar o ejecutar; usa los presets seguro/autónomo en Settings.",
    tags: ["permisos", "tools", "seguridad", "askBeforeTools"],
    doc: "docs/ARCHITECTURE.md",
  },
  {
    id: "sandbox",
    title: "Sandbox Docker",
    body: "Activa el sandbox para ejecutar comandos en un contenedor sin red y con el worktree montado en solo lectura.",
    tags: ["docker", "sandbox", "aislamiento"],
    doc: "docs/ARCHITECTURE.md",
  },
  {
    id: "plugins",
    title: "Plugins y skills",
    body: "Crea plugins declarativos (stage/match/action) y skills con needs para que el compiler las dispare por intención.",
    tags: ["plugin", "skill", "autoría", "sdk"],
    doc: "docs/PLUGIN-SDK.md",
  },
  {
    id: "graph",
    title: "Grafo de dependencias",
    body: "El panel Graph muestra imports/refs por stack, ciclos y cambios en vivo; los paneles flotantes recuerdan su layout.",
    tags: ["grafo", "dependencias", "layout"],
    doc: "docs/ARCHITECTURE.md",
  },
  {
    id: "rag",
    title: "RAG e indexación",
    body: "El índice RAG alimenta el contexto. Usa el RAG Inspector para ver documentos, excluir rutas y reindexar.",
    tags: ["rag", "índice", "contexto"],
    doc: "docs/HANDBOOK.md",
  },
];

export function searchHelp(query: string, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return topics;
  return topics.filter((topic) => {
    const haystack = `${topic.title} ${topic.body} ${topic.tags.join(" ")} ${topic.doc ?? ""}`.toLowerCase();
    return normalized.split(/\s+/).every((token) => haystack.includes(token));
  });
}
