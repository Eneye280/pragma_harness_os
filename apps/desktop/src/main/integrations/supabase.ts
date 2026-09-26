export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface IntegrationTestResult {
  ok: boolean;
  status: number;
  detail: string;
}

export type IntegrationFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number }>;

export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function testSupabase(config: SupabaseConfig, fetchImpl?: IntegrationFetch): Promise<IntegrationTestResult> {
  if (!config.url.trim()) return { ok: false, status: 0, detail: "falta la URL del proyecto" };
  if (!config.anonKey.trim()) return { ok: false, status: 0, detail: "falta la anon key" };
  const target = `${normalizeSupabaseUrl(config.url)}/rest/v1/`;
  const doFetch = fetchImpl ?? (fetch as unknown as IntegrationFetch);
  try {
    const response = await doFetch(target, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
    if (response.status === 401 || response.status === 403) return { ok: false, status: response.status, detail: "anon key rechazada (401/403)" };
    if (response.status === 404) return { ok: false, status: 404, detail: "proyecto no encontrado en esa URL" };
    return { ok: response.ok, status: response.status, detail: response.ok ? "REST disponible" : `http ${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, detail: `sin conexión: ${error instanceof Error ? error.message : "fetch failed"}` };
  }
}
