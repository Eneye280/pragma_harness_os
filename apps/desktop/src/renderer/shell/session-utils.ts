import type { SessionSummary } from "@shared/session";

export function filterSessions(sessions: SessionSummary[], query: string): SessionSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sessions;
  return sessions.filter((session) => session.title.toLowerCase().includes(normalized));
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (diffSeconds < 60) return "ahora";
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} mes${months === 1 ? "" : "es"}`;
}

export function basename(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? filePath;
}
