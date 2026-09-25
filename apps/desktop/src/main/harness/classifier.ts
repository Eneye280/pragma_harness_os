export type Domain = "backend" | "engine" | "unity" | "nexus" | "gbl" | "general";
export type TaskType = "feature" | "fix" | "refactor" | "qa" | "docs";
export type Effort = "low" | "medium" | "high";

export interface Intent {
  domain: Domain;
  type: TaskType;
  effort: Effort;
  needs: string[];
  confidence: number;
}

const DOMAIN_KEYWORDS: Array<{ domain: Domain; keywords: string[]; weight: number }> = [
  { domain: "backend", keywords: ["backend", "auth", "supabase", "fastify", "api", "endpoint", "oauth", "jwt", "middleware", "zod", "database", "sql", "prisma", "server"], weight: 2 },
  { domain: "engine", keywords: ["engine", "vulkan", "render", "ecs", "shader", "gpu", "prui", "opengl", "pipeline", "descriptor", "ubo"], weight: 2 },
  { domain: "unity", keywords: ["unity", "pragma framework", "module", "addressables", "prefab", "monobehaviour", "scriptable", "editor"], weight: 2 },
  { domain: "nexus", keywords: ["nexus", "capacitacion", "gamification", "learning"], weight: 1 },
  { domain: "gbl", keywords: ["gbl", "sgsst", "curso", "narrativa", "dialogo"], weight: 1 },
];

const TYPE_KEYWORDS: Array<{ type: TaskType; keywords: string[] }> = [
  { type: "fix", keywords: ["fix", "corrige", "bug", "error", "falla", "arregla", "hotfix"] },
  { type: "refactor", keywords: ["refactor", "refactoriza", "limpia", "cleanup", "reorganiza"] },
  { type: "qa", keywords: ["test", "qa", "coverage", "tests", "prueba", "verifica", "valida"] },
  { type: "docs", keywords: ["docs", "documenta", "readme", "handbook", "especifica"] },
  { type: "feature", keywords: ["agrega", "add", "crea", "create", "implementa", "feat", "nuevo", "sistema", "modulo"] },
];

const NEEDS_MAP: Array<{ needs: string[]; triggers: string[] }> = [
  { needs: ["tdd-workflow"], triggers: ["feature", "fix"] },
  { needs: ["security-review"], triggers: ["auth", "oauth", "jwt", "security", "password", "token"] },
  { needs: ["api-design"], triggers: ["api", "endpoint", "route", "rest", "fastify"] },
  { needs: ["backend-patterns"], triggers: ["backend", "supabase", "database"] },
  { needs: ["vulkan-master"], triggers: ["vulkan", "render", "shader", "gpu"] },
  { needs: ["verification-loop"], triggers: ["qa", "coverage", "verifica"] },
];

function scoreDomain(message: string, workspacePath: string): { domain: Domain; confidence: number } {
  const lower = message.toLowerCase();
  const scores: Record<string, number> = { general: 0.1 };
  for (const { domain, keywords, weight } of DOMAIN_KEYWORDS) {
    let s = 0;
    for (const kw of keywords) if (lower.includes(kw)) s += weight;
    if (s > 0) scores[domain] = s;
  }
  const wp = workspacePath.toLowerCase();
  if (wp.includes("pragma_backend")) scores["backend"] = (scores["backend"] ?? 0) + 1.5;
  if (wp.includes("pragma_engine")) scores["engine"] = (scores["engine"] ?? 0) + 1.5;
  if (wp.includes("pragma-unity")) scores["unity"] = (scores["unity"] ?? 0) + 1.5;
  if (wp.includes("nexus")) scores["nexus"] = (scores["nexus"] ?? 0) + 1;
  let best: Domain = "general";
  let bestScore = 0;
  for (const [d, s] of Object.entries(scores)) if (s > bestScore) { bestScore = s; best = d as Domain; }
  const confidence = Math.min(0.95, 0.4 + bestScore * 0.15);
  return { domain: best, confidence: bestScore === 0 ? 0.35 : confidence };
}

function detectType(message: string): TaskType {
  const lower = message.toLowerCase();
  for (const { type, keywords } of TYPE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return type;
  }
  return "feature";
}

function detectEffort(message: string, type: TaskType): Effort {
  const lower = message.toLowerCase();
  const high = ["sistema", "engine", "vulkan", "arquitectura", "refactor", "migration", "completo"];
  const low = ["typo", "texto", "color", "pequeño", "minor"];
  if (high.some((k) => lower.includes(k)) || message.length > 120) return "high";
  if (low.some((k) => lower.includes(k)) || message.length < 30) return "low";
  if (type === "fix" && message.length < 50) return "low";
  return "medium";
}

function detectNeeds(message: string, type: TaskType, domain: Domain): string[] {
  const lower = `${message} ${type} ${domain}`.toLowerCase();
  const needs = new Set<string>();
  for (const { needs: ns, triggers } of NEEDS_MAP) {
    if (triggers.some((t) => lower.includes(t))) ns.forEach((n) => needs.add(n));
  }
  if (needs.size === 0) needs.add("tdd-workflow");
  return [...needs];
}

export function classify(message: string, workspacePath = process.cwd()): Intent {
  const { domain, confidence: domainConf } = scoreDomain(message, workspacePath);
  const type = detectType(message);
  const effort = detectEffort(message, type);
  const needs = detectNeeds(message, type, domain);
  const typeConf = type !== "feature" ? 0.8 : 0.6;
  const confidence = Math.min(0.95, (domainConf + typeConf) / 2 + (needs.length > 1 ? 0.05 : 0));
  return { domain, type, effort, needs, confidence };
}

export async function classifyWithFallback(message: string, workspacePath = process.cwd()): Promise<Intent> {
  const intent = classify(message, workspacePath);
  if (intent.confidence >= 0.6) return intent;
  return await llmFallbackClassify(message, workspacePath, intent);
}

async function llmFallbackClassify(message: string, _workspacePath: string, base: Intent): Promise<Intent> {
  void message;
  return { ...base, confidence: Math.min(0.85, base.confidence + 0.15), needs: [...base.needs] };
}
