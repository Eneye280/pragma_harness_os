export interface Citation {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  retrievedAt: number;
}

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /(?<!\()(https?:\/\/[^\s)]+)/g;
const VERSION_CLAIM = /\b(v\d+(?:\.\d+)*|version\s+\d+|\bapi\s+de\s+\w+\b|\bSDK\s+\w+|deprecated|breaking change|desde\s+la\s+versión)\b/i;

export function extractCitations(text: string): Citation[] {
  const found = new Map<string, Citation>();
  const now = Date.now();
  for (const match of text.matchAll(MD_LINK)) {
    const url = match[2];
    if (!found.has(url)) {
      found.set(url, { id: `c${found.size + 1}`, url, title: match[1].trim(), excerpt: "", retrievedAt: now });
    }
  }
  for (const match of text.matchAll(BARE_URL)) {
    const url = match[1].replace(/[.,;]+$/, "");
    if (!found.has(url)) {
      found.set(url, { id: `c${found.size + 1}`, url, title: url, excerpt: "", retrievedAt: now });
    }
  }
  return [...found.values()];
}

export function hasCitations(text: string): boolean {
  return extractCitations(text).length > 0;
}

export interface VeracityReport {
  requiresSources: boolean;
  hasSources: boolean;
  ok: boolean;
  reason: string;
}

export function veracityReview(text: string): VeracityReport {
  const requiresSources = VERSION_CLAIM.test(text);
  const hasSources = hasCitations(text);
  return {
    requiresSources,
    hasSources,
    ok: !requiresSources || hasSources,
    reason: requiresSources
      ? hasSources
        ? "afirmaciones con fuente citada"
        : "afirma versiones/APIs sin citar una fuente verificable"
      : "sin afirmaciones que requieran fuente",
  };
}

export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return "";
  return citations.map((citation) => `[${citation.id}] ${citation.title} — ${citation.url}`).join("\n");
}
