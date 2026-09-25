import type { PlanIntent, PlanProposal } from "../../shared/plan";

const FILE_PATTERN = /\b[A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z0-9]{1,6}\b/g;
const MODULE_PATTERN = /\b(?:m[oó]dulo|module)\s+((?:[A-Za-z0-9_-]+\s+){0,2}[A-Za-z0-9_-]+)/gi;
const SIGNIFICANT_PATTERN = /\b(m[oó]dulo|modulo|sistema|arquitectura|pipeline|endpoint|api)\b/i;
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "para", "con", "y", "en", "que", "se"]);

function firstMeaningfulToken(phrase: string): string | null {
  for (const token of phrase.split(/\s+/)) {
    const normalized = token.toLowerCase();
    if (normalized && !STOPWORDS.has(normalized)) return normalized;
  }
  return null;
}

export function shouldProposePlan(intent: PlanIntent, message: string): boolean {
  if (intent.type !== "feature") return false;
  if (intent.effort === "medium" || intent.effort === "high") return true;
  return SIGNIFICANT_PATTERN.test(message);
}

function defaultFileForDomain(domain: string): string {
  switch (domain) {
    case "backend":
      return "src/modules/index.ts";
    case "engine":
      return "src/engine/index.cs";
    case "unity":
      return "Assets/Scripts/Module.cs";
    default:
      return "src/index.ts";
  }
}

export function extractPlanFiles(message: string, intent: PlanIntent): string[] {
  const files = new Set<string>();

  for (const match of message.matchAll(FILE_PATTERN)) {
    const candidate = match[0];
    if (/^\d/.test(candidate) || candidate.includes("..") || candidate.length < 4) continue;
    if (/^(https?|www)\./i.test(candidate)) continue;
    files.add(candidate);
  }

  for (const match of message.matchAll(MODULE_PATTERN)) {
    const moduleName = firstMeaningfulToken(match[1]);
    if (!moduleName || moduleName.length < 2) continue;
    files.add(`src/modules/${moduleName}/index.ts`);
    files.add(`src/modules/${moduleName}/${moduleName}.test.ts`);
  }

  if (files.size === 0) files.add(defaultFileForDomain(intent.domain));
  return [...files].slice(0, 10);
}

export function extractFilesFromMarkdown(markdown: string): string[] {
  const files = new Set<string>();
  for (const match of markdown.matchAll(FILE_PATTERN)) {
    const candidate = match[0];
    if (/^\d/.test(candidate) || candidate.includes("..")) continue;
    if (/^(https?|www)\./i.test(candidate)) continue;
    files.add(candidate);
  }
  return [...files].slice(0, 10);
}

export function buildPlanMarkdown(message: string, intent: PlanIntent, files: string[]): string {
  const stepsByNeed: Record<string, string> = {
    "tdd-workflow": "Escribir el test en rojo y luego la implementación mínima",
    "security-review": "Revisar validación de entrada y exposición de datos",
    "api-design": "Definir el contrato del endpoint y sus esquemas",
    "backend-patterns": "Aplicar los patrones de backend del dominio",
    "vulkan-master": "Respetar el pipeline Vulkan y el contrato de recursos",
    "verification-loop": "Correr la verificación de 6 fases",
  };
  const steps = intent.needs.map((need) => stepsByNeed[need] ?? `Aplicar ${need}`);

  return [
    `# Plan — ${message.slice(0, 70)}`,
    "",
    "## Objetivo",
    message,
    "",
    "## Intención",
    `${intent.domain} · ${intent.type} · effort ${intent.effort} · needs: ${intent.needs.join(", ") || "ninguna"}`,
    "",
    "## Pasos",
    ...(steps.length > 0 ? steps.map((step, index) => `${index + 1}. ${step}`) : ["1. Implementar el cambio"]),
    "2. Ejecutar gates post-agente (build, typecheck, lint, tests, security)",
    "",
    "## Archivos",
    ...files.map((file) => `- ${file}`),
    "",
    "## Verificación",
    "- tests en verde con cobertura >= 80%",
    "- sin secretos ni console.log en el diff",
  ].join("\n");
}

export function buildPlan(message: string, intent: PlanIntent, sessionId: string): PlanProposal {
  const files = extractPlanFiles(message, intent);
  return {
    sessionId,
    title: `Plan — ${message.slice(0, 70)}`,
    markdown: buildPlanMarkdown(message, intent, files),
    files,
    intent,
    revised: false,
    createdAt: Date.now(),
  };
}

export function recompilePlan(markdown: string, sessionId: string, intent: PlanIntent): PlanProposal {
  const files = extractFilesFromMarkdown(markdown);
  const headingMatch = /^#\s+(.*)$/m.exec(markdown);
  return {
    sessionId,
    title: headingMatch ? headingMatch[1].trim() : "Plan revisado",
    markdown,
    files,
    intent,
    revised: true,
    createdAt: Date.now(),
  };
}
