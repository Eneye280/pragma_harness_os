const DEFAULT_DOC_DOMAINS = [
  "developer.mozilla.org",
  "docs.unity3d.com",
  "docs.microsoft.com",
  "learn.microsoft.com",
  "nodejs.org",
  "www.typescriptlang.org",
  "react.dev",
  "supabase.com",
  "www.roblox.com",
  "create.roblox.com",
  "github.com",
  "raw.githubusercontent.com",
  "zod.dev",
  "fastify.dev",
];

export interface WebFetchResult {
  ok: boolean;
  url: string;
  status: number;
  title: string;
  excerpt: string;
  error?: string;
}

export function isAllowedUrl(rawUrl: string, domains: string[] = DEFAULT_DOC_DOMAINS): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1].replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webFetch(
  url: string,
  options: { domains?: string[]; timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<WebFetchResult> {
  if (!isAllowedUrl(url, options.domains)) {
    return { ok: false, url, status: 0, title: "", excerpt: "", error: "dominio no permitido (solo docs oficiales por HTTPS)" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "text/html" } });
    const body = await response.text();
    return {
      ok: response.ok,
      url,
      status: response.status,
      title: extractTitle(body),
      excerpt: toText(body).slice(0, 4000),
      error: response.ok ? undefined : `http ${response.status}`,
    };
  } catch (error) {
    return { ok: false, url, status: 0, title: "", excerpt: "", error: error instanceof Error ? error.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}
