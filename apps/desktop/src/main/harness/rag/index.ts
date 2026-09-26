import { readFileSync, existsSync } from "fs";
import { join } from "path";
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
  excludes?: string[];
}

export interface RagProgress {
  processed: number;
  total: number;
  path?: string;
  done: boolean;
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

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`).test(path) || new RegExp(`(^|/)${escaped}$`).test(path);
  });
}

export class RagIndex {
  private docs: Array<{ path: string; content: string }> = [];
  private excludes: string[] = [];
  private options: Required<RagIndexOptions>;

  constructor(opts: RagIndexOptions = {}) {
    this.options = {
      root: opts.root ?? join(process.cwd(), "..", ".."),
      patterns: opts.patterns ?? DEFAULT_PATTERNS,
      maxFileChars: opts.maxFileChars ?? 8000,
      excludes: opts.excludes ?? [],
    };
    this.excludes = [...this.options.excludes];
    if (!existsSync(this.options.root)) this.options.root = process.cwd();
  }

  private async collectFiles(): Promise<string[]> {
    const files: string[] = [];
    for (const pat of this.options.patterns) {
      const matched = await fg(pat, { cwd: this.options.root, absolute: false, onlyFiles: true }).catch(() => []);
      files.push(...matched);
    }
    return [...new Set(files)].filter((rel) => !this.isExcluded(rel));
  }

  isExcluded(path: string): boolean {
    return matchesAny(path, this.excludes);
  }

  getExcludes(): string[] {
    return [...this.excludes];
  }

  setExcludes(patterns: string[]): void {
    this.excludes = [...new Set(patterns.map((pattern) => pattern.trim()).filter(Boolean))];
    this.docs = this.docs.filter((doc) => !this.isExcluded(doc.path));
  }

  async index(onProgress?: (progress: RagProgress) => void): Promise<number> {
    const files = await this.collectFiles();
    this.docs = [];
    let processed = 0;
    for (const rel of files) {
      const abs = join(this.options.root, rel);
      processed += 1;
      if (!existsSync(abs)) {
        onProgress?.({ processed, total: files.length, path: rel, done: false });
        continue;
      }
      try {
        const raw = readFileSync(abs, "utf-8").slice(0, this.options.maxFileChars);
        this.docs.push({ path: rel, content: raw });
      } catch {}
      onProgress?.({ processed, total: files.length, path: rel, done: false });
    }
    onProgress?.({ processed: files.length, total: files.length, done: true });
    return this.docs.length;
  }

  async reindex(mode: "full" | "incremental", onProgress?: (progress: RagProgress) => void): Promise<number> {
    if (mode === "full") return this.index(onProgress);
    const files = await this.collectFiles();
    const known = new Set(this.docs.map((doc) => doc.path));
    const pending = files.filter((rel) => !known.has(rel));
    let processed = 0;
    for (const rel of pending) {
      const abs = join(this.options.root, rel);
      processed += 1;
      if (!existsSync(abs)) continue;
      try {
        const raw = readFileSync(abs, "utf-8").slice(0, this.options.maxFileChars);
        this.docs.push({ path: rel, content: raw });
      } catch {}
      onProgress?.({ processed, total: pending.length, path: rel, done: false });
    }
    onProgress?.({ processed: pending.length, total: pending.length, done: true });
    return this.docs.length;
  }

  addDocument(path: string, content: string): void {
    if (this.isExcluded(path)) return;
    this.docs.push({ path, content: content.slice(0, this.options.maxFileChars) });
  }

  listDocuments(): Array<{ path: string; chars: number }> {
    return this.docs.map((doc) => ({ path: doc.path, chars: doc.content.length }));
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
