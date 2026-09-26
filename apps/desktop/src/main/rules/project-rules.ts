import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface ProjectRule {
  id: string;
  text: string;
}

const FILE = ".pragma-harness/rules.json";

function filePath(workspacePath: string): string {
  return join(workspacePath, FILE);
}

/** Reglas del proyecto: se inyectan en el bloque de reglas del harness. */
export function readProjectRules(workspacePath: string | null | undefined): ProjectRule[] {
  if (!workspacePath) return [];
  const path = filePath(workspacePath);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (typeof entry === "string" ? { id: ruleId(entry), text: entry } : (entry as ProjectRule)))
      .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim().length > 0)
      .map((entry) => ({ id: entry.id || ruleId(entry.text), text: entry.text.trim() }));
  } catch {
    return [];
  }
}

export function addProjectRule(workspacePath: string, text: string): ProjectRule[] {
  const trimmed = text.trim();
  if (!trimmed) return readProjectRules(workspacePath);
  const rules = readProjectRules(workspacePath);
  if (!rules.some((rule) => rule.text === trimmed)) rules.push({ id: ruleId(trimmed), text: trimmed });
  persist(workspacePath, rules);
  return rules;
}

export function removeProjectRule(workspacePath: string, id: string): ProjectRule[] {
  const rules = readProjectRules(workspacePath).filter((rule) => rule.id !== id);
  persist(workspacePath, rules);
  return rules;
}

function persist(workspacePath: string, rules: ProjectRule[]): void {
  const path = filePath(workspacePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(rules, null, 2)}\n`, "utf8");
}

function ruleId(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return `pr-${hash.toString(16).slice(0, 8)}`;
}
