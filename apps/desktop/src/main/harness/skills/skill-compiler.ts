import { existsSync, readFileSync, watch } from "fs";
import { join } from "path";
import { createHash } from "crypto";

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
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l.trim().length > 0);
    const deduped = lines.filter((l) => {
      const key = l.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    out.push(deduped.join("\n"));
  }
  return out;
}

export class SkillCompiler {
  private cache = new Map<string, CompiledSkills>();
  private root: string;

  constructor(root?: string) {
    this.root = root ?? join(process.cwd());
    this.watchRoots();
  }

  resolve(needs: string[]): string[] {
    const skills: string[] = [];
    for (const need of needs) {
      const skill = NEEDS_TO_SKILL[need] ?? need;
      if (!skills.includes(skill)) skills.push(skill);
    }
    return skills.sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a);
      const pb = PRIORITY_ORDER.indexOf(b);
      const ia = pa === -1 ? 99 : pa;
      const ib = pb === -1 ? 99 : pb;
      return ia - ib;
    });
  }

  async compile(skillNames: string[], maxTokens = 2000): Promise<CompiledSkills> {
    const key = createHash("sha256").update(skillNames.join(",") + ":" + maxTokens).digest("hex").slice(0, 12);
    const cached = this.cache.get(key);
    if (cached) return { ...cached, fromCache: true };

    const blocks: string[] = [];
    const sources: string[] = [];

    for (const name of skillNames) {
      const candidates = [
        join(this.root, "skills", name, "SKILL.md"),
        join(this.root, "apps", "desktop", "skills", name, "SKILL.md"),
        join(process.cwd(), "skills", name, "SKILL.md"),
        join(process.cwd(), "..", "..", "skills", name, "SKILL.md"),
        join(process.cwd(), "..", "skills", name, "SKILL.md"),
      ];
      let content: string | null = null;
      for (const p of candidates) {
        if (existsSync(p)) {
          content = readFileSync(p, "utf-8");
          break;
        }
      }
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

  private watchRoots(): void {
    try {
      const watchPath = join(this.root, "skills");
      if (existsSync(watchPath)) {
        watch(watchPath, { recursive: true }, () => this.clearCache());
      }
    } catch {}
  }
}

export const skillCompiler = new SkillCompiler();
