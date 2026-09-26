export const KNOWN_NEEDS = [
  "tdd-workflow",
  "security-review",
  "api-design",
  "backend-patterns",
  "vulkan-master",
  "verification-loop",
] as const;

export const REQUIRED_SECTIONS = ["When to use", "Procedure", "Rules", "Done when"] as const;

export interface SkillFrontmatter {
  name: string;
  description: string;
  triggers: string[];
  needs: string[];
  priority: number;
}

export interface SkillValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function defaultSkillBody(): string {
  return [
    "## When to use",
    "Describe the situation that should activate this skill.",
    "",
    "## Procedure",
    "- Step one.",
    "- Step two.",
    "",
    "## Rules",
    "- Constraints and guardrails.",
    "",
    "## Done when",
    "- Observable acceptance criteria.",
    "",
  ].join("\n");
}

function parseList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function parseSkillDoc(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = FRONTMATTER.exec(content);
  const frontmatter: SkillFrontmatter = { name: "", description: "", triggers: [], needs: [], priority: 99 };
  let body = content;
  if (match) {
    body = match[2];
    for (const rawLine of match[1].split(/\r?\n/)) {
      const line = rawLine.trim();
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === "name") frontmatter.name = value;
      else if (key === "description") frontmatter.description = value;
      else if (key === "triggers") frontmatter.triggers = parseList(value);
      else if (key === "needs") frontmatter.needs = parseList(value);
      else if (key === "priority") frontmatter.priority = Number.isFinite(Number(value)) ? Number(value) : 99;
    }
  }
  return { frontmatter, body: body.trim() };
}

export function serializeSkillDoc(frontmatter: SkillFrontmatter, body: string): string {
  const lines = [
    "---",
    `name: ${frontmatter.name.trim()}`,
    `description: ${frontmatter.description.trim()}`,
    `triggers: [${frontmatter.triggers.map((trigger) => trigger.trim()).filter(Boolean).join(", ")}]`,
    `needs: [${frontmatter.needs.map((need) => need.trim()).filter(Boolean).join(", ")}]`,
    `priority: ${Number.isFinite(frontmatter.priority) ? frontmatter.priority : 99}`,
    "---",
    "",
    body.trim(),
    "",
  ];
  return lines.join("\n");
}

export function needsFromTriggers(triggers: string[]): string[] {
  const known = new Set<string>(KNOWN_NEEDS);
  return triggers.map((trigger) => trigger.trim().toLowerCase()).filter((trigger) => known.has(trigger));
}

export function validateSkillDoc(content: string): SkillValidation {
  const { frontmatter, body } = parseSkillDoc(content);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!frontmatter.name.trim()) errors.push("falta el campo name");
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(frontmatter.name.trim())) errors.push("name debe ser kebab-case (a-z, 0-9, -)");
  if (!frontmatter.description.trim()) errors.push("falta el campo description");
  if (frontmatter.triggers.length === 0) errors.push("define al menos un trigger");
  if (frontmatter.needs.length === 0) warnings.push("sin needs: la skill no se disparará por intención del classifier");
  else {
    const unknown = frontmatter.needs.filter((need) => !(KNOWN_NEEDS as readonly string[]).includes(need));
    if (unknown.length > 0) warnings.push(`needs desconocidos: ${unknown.join(", ")}`);
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^#{1,6}\\s*${section}\\b`, "im").test(body)) warnings.push(`falta la sección "## ${section}"`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
