import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

export interface SkillEntry {
  name: string;
  description: string;
  triggers: string[];
  priority: number;
  path: string;
}

interface Frontmatter {
  name?: string;
  description?: string;
  triggers?: string[];
  priority?: number;
}

export function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Frontmatter = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "name") fields.name = value;
    else if (key === "description") fields.description = value;
    else if (key === "priority") fields.priority = Number(value);
    else if (key === "triggers") {
      fields.triggers = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return fields;
}

export function scanSkillsRoot(root: string): SkillEntry[] {
  const skillsDirectory = join(root, "skills");
  if (!existsSync(skillsDirectory)) return [];
  const entries: SkillEntry[] = [];
  for (const dirent of readdirSync(skillsDirectory, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name.startsWith("_")) continue;
    const file = join(skillsDirectory, dirent.name, "SKILL.md");
    if (!existsSync(file)) continue;
    try {
      const content = readFileSync(file, "utf8");
      const meta = parseFrontmatter(content);
      entries.push({
        name: meta.name || dirent.name,
        description: meta.description ?? "",
        triggers: meta.triggers ?? [],
        priority: Number.isFinite(meta.priority) ? (meta.priority as number) : 99,
        path: file,
      });
    } catch {
      continue;
    }
  }
  return entries;
}

export class SkillCatalog {
  private cache = new Map<string, { mtimeMs: number; entries: SkillEntry[] }>();

  constructor(private readonly getRoots: () => string[]) {}

  roots(): string[] {
    return [...new Set(this.getRoots().filter(Boolean))];
  }

  scan(): SkillEntry[] {
    const byName = new Map<string, SkillEntry>();
    for (const root of this.roots()) {
      for (const entry of this.scanRoot(root)) {
        if (!byName.has(entry.name)) byName.set(entry.name, entry);
      }
    }
    return [...byName.values()].sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name));
  }

  get(name: string): SkillEntry | null {
    return this.scan().find((entry) => entry.name === name) ?? null;
  }

  private scanRoot(root: string): SkillEntry[] {
    const marker = join(root, "skills");
    if (!existsSync(marker)) {
      this.cache.delete(marker);
      return [];
    }
    let mtimeMs = 0;
    try {
      mtimeMs = statSync(marker).mtimeMs;
    } catch {
      return [];
    }
    const cached = this.cache.get(marker);
    if (cached && cached.mtimeMs === mtimeMs) return cached.entries;
    const entries = scanSkillsRoot(root);
    this.cache.set(marker, { mtimeMs, entries });
    return entries;
  }
}
