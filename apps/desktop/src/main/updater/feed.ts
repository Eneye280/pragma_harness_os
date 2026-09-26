export type UpdateChannel = "stable" | "beta";

export interface UpdateFeedSettings {
  url: string;
  token?: string;
  channel: UpdateChannel;
}

export interface ReleaseInfo {
  version: string;
  notes: string;
  url?: string;
  channel: UpdateChannel;
}

export interface FeedResult {
  ok: boolean;
  available: boolean;
  reason: string;
  release: ReleaseInfo | null;
}

export interface FeedManifest {
  releases?: Array<{ version?: unknown; notes?: unknown; url?: unknown; channel?: unknown }>;
  version?: unknown;
  notes?: unknown;
  url?: unknown;
  channel?: unknown;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function compareVersions(left: string, right: string): number {
  const normalize = (value: string) => value.replace(/^v/i, "").split("-")[0].split(".").map((part) => Number(part) || 0);
  const a = normalize(left);
  const b = normalize(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function isNewer(current: string, candidate: string): boolean {
  return compareVersions(candidate, current) > 0;
}

function normalizeChannel(value: unknown): UpdateChannel {
  return value === "beta" ? "beta" : "stable";
}

export function parseManifest(manifest: FeedManifest, channel: UpdateChannel): ReleaseInfo | null {
  const releases = Array.isArray(manifest.releases) ? manifest.releases : [manifest];
  const parsed = releases
    .map((entry) => ({
      version: typeof entry.version === "string" ? entry.version : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      url: typeof entry.url === "string" ? entry.url : undefined,
      channel: normalizeChannel(entry.channel),
    }))
    .filter((release) => release.version);
  const matching = parsed.filter((release) => release.channel === (channel === "beta" ? "beta" : "stable"));
  const pool = matching.length > 0 ? matching : channel === "beta" ? parsed : [];
  if (pool.length === 0) return null;
  return pool.sort((left, right) => compareVersions(right.version, left.version))[0];
}

export async function fetchRelease(
  feed: UpdateFeedSettings,
  currentVersion: string,
  fetchImpl: FetchLike
): Promise<FeedResult> {
  if (!feed.url.trim()) {
    return { ok: true, available: false, reason: "sin feed configurado", release: null };
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (feed.token) headers.Authorization = `Bearer ${feed.token}`;
  try {
    const response = await fetchImpl(feed.url, { headers });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, available: false, reason: "feed privado: token inválido o ausente (401/403)", release: null };
    }
    if (response.status === 404) {
      return { ok: false, available: false, reason: "feed no encontrado (404)", release: null };
    }
    if (!response.ok) {
      return { ok: false, available: false, reason: `feed respondió ${response.status}`, release: null };
    }
    const manifest = (await response.json()) as FeedManifest;
    const release = parseManifest(manifest, feed.channel);
    if (!release) {
      return { ok: true, available: false, reason: `sin releases para el canal ${feed.channel}`, release: null };
    }
    const available = isNewer(currentVersion, release.version);
    return {
      ok: true,
      available,
      reason: available ? `versión ${release.version} disponible` : `al día (última ${release.version})`,
      release,
    };
  } catch (error) {
    return { ok: false, available: false, reason: `feed offline: ${error instanceof Error ? error.message : "sin conexión"}`, release: null };
  }
}
