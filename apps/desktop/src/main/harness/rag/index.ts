import { readFileSync, existsSync } from "fs";
import { join, relative } from "path";
import fg from "fast-glob";

export interface RagHit {
  path: string;
  content: string;
  score: number;
  snippet: string;
}

export interface RagIndexOptions {
  root?: string;
  patterns?: string[];
  maxFileChars?: number;
}

const DEFAULT_PATTERNS = [
  "skills/**/SKILL.md",
  "docs/**/*.md",
  "AGENTS.md",
  "README.md",
  "apps/desktop/skills/**/SKILL.md",
];

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreQuery(query: string, content: string): number {
  const qTokens = tokenize(query);
  const cTokens = new Set(tokenize(content));
  if (qTokens.length === 0) return 0;
  let hits = 0;
  for (const q of qTokens) if (cTokens.has(q)) hits++;
  const base = hits / qTokens.length;
  const boost = content.toLowerCase().includes(query.toLowerCase()) ? 0.3 : 0;
  return Math.min(1, base + boost);
}

function snippet(content: string, query: string, len = 200): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, len);
  const start = Math.max(0, idx - 80);
  return content.slice(start, start + len);
}

export class RagIndex {
  private docs: Array<{ path: string; content: string }> = [];
  private options: Required<RagIndexOptions>;

  constructor(opts: RagIndexOptions = {}) {
    this.options = {
      root: opts.root ?? join(process.cwd(), "..", ".."),
      patterns: opts.patterns ?? DEFAULT_PATTERNS,
      maxFileChars: opts.maxFileChars ?? 8000,
    };
    if (!existsSync(this.options.root)) this.options.root = process.cwd();
  }

  async index(): Promise<number> {
    this.docs = [];
    for (const pat of this.options.patterns) {
      const files = await fg(pat, { cwd: this.options.root, absolute: false, onlyFiles: true }).catch(() => []);
      for (const rel of files) {
        const abs = join(this.options.root, rel);
        if (!existsSync(abs)) continue;
        try {
          const raw = readFileSync(abs, "utf-8").slice(0, this.options.maxFileChars);
          this.docs.push({ path: rel, content: raw });
        } catch {}
      }
    }
    return this.docs.length;
  }

  addDocument(path: string, content: string): void {
    this.docs.push({ path, content: content.slice(0, this.options.maxFileChars) });
  }

  recall(query: string, topK = 5): RagHit[] {
    if (!query.trim() || this.docs.length === 0) return [];
    const scored = this.docs
      .map((d) => ({ doc: d, score: scoreQuery(query, d.content) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored.map(({ doc, score }) => ({
      path: doc.path,
      content: doc.content,
      score,
      snippet: snippet(doc.content, query),
    }));
  }

  get size(): number {
    return this.docs.length;
  }

  clear(): void {
    this.docs = [];
  }
}

export const ragIndex = new RagIndex();
