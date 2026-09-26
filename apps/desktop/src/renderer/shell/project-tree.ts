import type { SessionSummary } from "@shared/session";

export interface ProjectGroup {
  path: string;
  name: string;
  active: boolean;
  sessions: SessionSummary[];
}

export function basenameOf(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

const key = (path: string): string => path.replace(/[\\/]+$/, "").toLowerCase();

/**
 * Agrupa sesiones por proyecto (folder). El proyecto activo va primero y
 * siempre aparece, aunque todavía no tenga sesiones.
 */
export function groupSessionsByProject(
  sessions: SessionSummary[],
  activePath: string,
  recents: string[],
): ProjectGroup[] {
  const byProject = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const list = byProject.get(key(session.workspacePath)) ?? [];
    list.push(session);
    byProject.set(key(session.workspacePath), list);
  }
  for (const list of byProject.values()) list.sort((a, b) => b.updatedAt - a.updatedAt);

  const ordered: string[] = [];
  if (activePath) ordered.push(activePath);
  for (const recent of recents) {
    if (!ordered.some((path) => key(path) === key(recent))) ordered.push(recent);
  }
  for (const session of sessions) {
    if (!ordered.some((path) => key(path) === key(session.workspacePath))) ordered.push(session.workspacePath);
  }

  return ordered.map((path) => ({
    path,
    name: basenameOf(path),
    active: Boolean(activePath) && key(path) === key(activePath),
    sessions: byProject.get(key(path)) ?? [],
  }));
}
