import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import type { SkillSummary } from "../../../shared/skills";
import { SkillCatalog, type SkillEntry } from "./catalog";

export interface CompiledSkills {
  block: string;
  sources: string[];
  tokenCount: number;
  fromCache: boolean;
}

const NEEDS_TO_SKILL: Record<string, string> = {
  "tdd-workflow": "tdd-workflow",
  "security-review": "security-review",
  "api-design": "api-design",
  "backend-patterns": "api-design",
  "vulkan-master": "tdd-workflow",
  "verification-loop": "tdd-workflow",
};

const PRIORITY_ORDER = ["security-review", "tdd-workflow", "api-design"];
const DEFAULT_MAX_SKILLS = 6;

function tokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncate(text: string, maxTokens: number): string {
  if (tokenCount(text) <= maxTokens) return text;
  const marker = "\n…[truncated by token budget]";
  const maxChars = maxTokens * 4 - marker.length;
  return text.slice(0, Math.max(0, maxChars)) + marker;
}

function deduplicate(blocks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    const deduped = lines.filter((line) => {
      const key = line.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    out.push(deduped.join("\n"));
  }
  return out;
}

function rank(name: string, catalogPriority: number): number {
  const fixed = PRIORITY_ORDER.indexOf(name);
  return fixed === -1 ? 100 + catalogPriority : fixed;
}

export class SkillCompiler {
  private cache = new Map<string, CompiledSkills>();
  private readonly catalog: SkillCatalog;
  private rootsProvider: (() => string[]) | null = null;
  private enabledProvider: () => Record<string, boolean> = () => ({});

  constructor(private readonly defaultRoot: string = join(process.cwd())) {
    this.catalog = new SkillCatalog(() => (this.rootsProvider ? this.rootsProvider() : [this.defaultRoot]));
  }

  useRoots(provider: () => string[]): void {
    this.rootsProvider = provider;
    this.clearCache();
  }

  useEnabled(provider: () => Record<string, boolean>): void {
    this.enabledProvider = provider;
    this.clearCache();
  }

  isEnabled(name: string): boolean {
    return this.enabledProvider()[name] !== false;
  }

  list(): SkillSummary[] {
    return this.catalog.scan().map((entry) => ({
      name: entry.name,
      description: entry.description,
      triggers: entry.triggers,
      priority: entry.priority,
      path: entry.path,
      enabled: this.isEnabled(entry.name),
    }));
  }

  resolve(needs: string[], maxSkills: number = DEFAULT_MAX_SKILLS): string[] {
    const catalogEntries = this.catalog.scan();
    const byName = new Map(catalogEntries.map((entry) => [entry.name, entry]));
    const candidates = new Set<string>();

    for (const need of needs) {
      const normalized = need.trim().toLowerCase();
      if (!normalized) continue;
      candidates.add(NEEDS_TO_SKILL[normalized] ?? normalized);
      const byTrigger = catalogEntries.find((entry) => entry.triggers.some((trigger) => trigger.toLowerCase() === normalized));
      if (byTrigger) candidates.add(byTrigger.name);
    }

    return [...candidates]
      .filter((name) => this.isEnabled(name))
      .sort((left, right) => {
        const rankLeft = rank(left, byName.get(left)?.priority ?? 99);
        const rankRight = rank(right, byName.get(right)?.priority ?? 99);
        return rankLeft - rankRight || left.localeCompare(right);
      })
      .slice(0, Math.max(1, maxSkills));
  }

  async compile(skillNames: string[], maxTokens = 2000): Promise<CompiledSkills> {
    const key = createHash("sha256").update(skillNames.join(",") + ":" + maxTokens).digest("hex").slice(0, 12);
    const cached = this.cache.get(key);
    if (cached) return { ...cached, fromCache: true };

    const blocks: string[] = [];
    const sources: string[] = [];

    for (const name of skillNames) {
      const content = this.readSkill(name);
      if (content) {
        blocks.push(content);
        sources.push(name);
      }
    }

    const deduped = deduplicate(blocks);
    const combined = deduped.join("\n\n---\n\n");
    const truncated = truncate(combined, maxTokens);

    const result: CompiledSkills = {
      block: truncated,
      sources,
      tokenCount: tokenCount(truncated),
      fromCache: false,
    };
    this.cache.set(key, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private readSkill(name: string): string | null {
    const entry: SkillEntry | null = this.catalog.get(name);
    if (entry && existsSync(entry.path)) return readFileSync(entry.path, "utf8");
    for (const candidate of this.legacyCandidates(name)) {
      if (existsSync(candidate)) return readFileSync(candidate, "utf8");
    }
    return null;
  }

  private legacyCandidates(name: string): string[] {
    return [
      join(this.defaultRoot, "skills", name, "SKILL.md"),
      join(this.defaultRoot, "apps", "desktop", "skills", name, "SKILL.md"),
      join(process.cwd(), "skills", name, "SKILL.md"),
      join(process.cwd(), "..", "..", "skills", name, "SKILL.md"),
      join(process.cwd(), "..", "skills", name, "SKILL.md"),
    ];
  }
}

export const skillCompiler = new SkillCompiler();
export { NEEDS_TO_SKILL, DEFAULT_MAX_SKILLS };
