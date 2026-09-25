import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { createHash, randomUUID } from "crypto";
import { homedir, tmpdir } from "os";

export interface Instinct {
  id: string;
  trigger: string;
  content: string;
  confidence: number;
  domain: string;
  evidence: string[];
  count: number;
  createdAt: number;
  updatedAt: number;
}

function getVaultRoot(): string {
  const configuredRoot = process.env["HARNESS_MEMORY_ROOT"];
  if (configuredRoot) {
    if (!existsSync(configuredRoot)) mkdirSync(configuredRoot, { recursive: true });
    return configuredRoot;
  }
  try {
    const base = join(homedir(), ".pragma-harness", "memory");
    if (!existsSync(base)) mkdirSync(base, { recursive: true });
    return base;
  } catch {
    const fallback = join(tmpdir(), "pragma-harness-memory");
    if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function hashWorkspace(workspacePath: string): string {
  return createHash("sha256").update(workspacePath).digest("hex").slice(0, 12);
}

export class MemoryVault {
  constructor(private readonly root: string = getVaultRoot()) {}

  private workspaceDir(workspacePath: string): string {
    const hash = hashWorkspace(workspacePath);
    const dir = join(this.root, hash);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private instinctsDir(workspacePath: string): string {
    const dir = join(this.workspaceDir(workspacePath), "instincts");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private instinctPath(workspacePath: string, id: string): string {
    return join(this.instinctsDir(workspacePath), `${id}.json`);
  }

  ensureWorkspace(workspacePath: string): void {
    this.workspaceDir(workspacePath);
    this.instinctsDir(workspacePath);
  }

  addInstinct(
    workspacePath: string,
    data: { trigger: string; content: string; domain?: string; evidence?: string }
  ): Instinct {
    const triggerKey = data.trigger.trim().toLowerCase();
    const existing = this.listInstincts(workspacePath).find((i) => i.trigger.toLowerCase() === triggerKey);

    if (existing) {
      const updated: Instinct = {
        ...existing,
        content: data.content,
        evidence: [...existing.evidence, data.evidence ?? ""].filter(Boolean).slice(-5),
        count: existing.count + 1,
        confidence: Math.min(0.95, existing.confidence + 0.12),
        updatedAt: Date.now(),
      };
      writeFileSync(this.instinctPath(workspacePath, existing.id), JSON.stringify(updated, null, 2));
      return updated;
    }

    const instinct: Instinct = {
      id: randomUUID().slice(0, 8),
      trigger: data.trigger,
      content: data.content,
      confidence: 0.5,
      domain: data.domain ?? "general",
      evidence: data.evidence ? [data.evidence] : [],
      count: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeFileSync(this.instinctPath(workspacePath, instinct.id), JSON.stringify(instinct, null, 2));
    return instinct;
  }

  contradict(workspacePath: string, trigger: string): Instinct | null {
    const key = trigger.trim().toLowerCase();
    const existing = this.listInstincts(workspacePath).find((i) => i.trigger.toLowerCase() === key);
    if (!existing) return null;
    const updated: Instinct = {
      ...existing,
      confidence: Math.max(0.1, existing.confidence - 0.2),
      updatedAt: Date.now(),
    };
    writeFileSync(this.instinctPath(workspacePath, existing.id), JSON.stringify(updated, null, 2));
    return updated;
  }

  listInstincts(workspacePath: string): Instinct[] {
    const dir = this.instinctsDir(workspacePath);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const out: Instinct[] = [];
    for (const f of files) {
      try {
        const raw = readFileSync(join(dir, f), "utf-8");
        out.push(JSON.parse(raw) as Instinct);
      } catch {}
    }
    return out;
  }

  recall(workspacePath: string, intent?: { domain?: string; needs?: string[] }, minConfidence = 0.6): Instinct[] {
    const all = this.listInstincts(workspacePath);
    return all
      .filter((i) => i.confidence >= minConfidence)
      .filter((i) => {
        if (!intent) return true;
        if (intent.domain && i.domain !== "general" && i.domain !== intent.domain) return false;
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  clear(workspacePath: string): void {
    const list = this.listInstincts(workspacePath);
    for (const i of list) {
      try {
        const { unlinkSync } = require("fs");
        unlinkSync(this.instinctPath(workspacePath, i.id));
      } catch {}
    }
  }

  getVaultRoot(): string {
    return this.root;
  }
}

export const vault = new MemoryVault();
