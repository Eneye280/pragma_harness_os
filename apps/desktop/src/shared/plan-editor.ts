export interface PlanStep {
  id: string;
  line: number;
  label: string;
  included: boolean;
}

const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TASK_SECTION = /(paso|step|plan|tarea|task|checklist|todo)/i;
const STEP_LINE = /^(\s*(?:\d+[.)]|[-*+])\s+)(.*)$/;
const OMITTED = /^\[omitido\]\s*/i;

function isStepLine(line: string): boolean {
  return /^\s*(?:\d+[.)]|[-*+]\s+\[[ xX]\])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);
}

export function parsePlanSteps(markdown: string): PlanStep[] {
  const steps: PlanStep[] = [];
  let inSection = false;
  markdown.split(/\r?\n/).forEach((rawLine, line) => {
    const heading = HEADING.exec(rawLine);
    if (heading) {
      inSection = TASK_SECTION.test(heading[1]);
      return;
    }
    if (!inSection || !isStepLine(rawLine)) return;
    const match = STEP_LINE.exec(rawLine);
    if (!match) return;
    const body = match[2].trim();
    if (!body) return;
    const included = !OMITTED.test(body);
    steps.push({ id: `s${steps.length + 1}`, line, label: body.replace(OMITTED, ""), included });
  });
  return steps;
}

function toLines(markdown: string): string[] {
  return markdown.split(/\r?\n/);
}

function renumber(lines: string[]): string[] {
  let counter = 0;
  return lines.map((line) => {
    const match = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(line);
    if (!match) return line;
    counter += 1;
    return `${match[1]}${counter}${match[3]}${match[4]}`;
  });
}

function applyToSteps(markdown: string, transform: (stepLines: string[]) => string[]): string {
  const lines = toLines(markdown);
  const indices: number[] = [];
  let inSection = false;
  lines.forEach((line, index) => {
    const heading = HEADING.exec(line);
    if (heading) {
      inSection = TASK_SECTION.test(heading[1]);
      return;
    }
    if (inSection && isStepLine(line)) indices.push(index);
  });
  if (indices.length === 0) return markdown;
  const stepLines = indices.map((index) => lines[index]);
  const transformed = renumber(transform(stepLines));
  indices.forEach((lineIndex, position) => {
    lines[lineIndex] = transformed[position];
  });
  return lines.join("\n");
}

export function setStepIncluded(markdown: string, stepId: string, included: boolean): string {
  const steps = parsePlanSteps(markdown);
  const target = steps.find((step) => step.id === stepId);
  if (!target) return markdown;
  return applyToSteps(markdown, (stepLines) =>
    stepLines.map((line, index) => {
      if (index !== steps.indexOf(target)) return line;
      const match = STEP_LINE.exec(line);
      if (!match) return line;
      const clean = match[2].replace(OMITTED, "");
      return `${match[1]}${included ? "" : "[omitido] "}${clean}`;
    })
  );
}

export function moveStep(markdown: string, stepId: string, direction: -1 | 1): string {
  const steps = parsePlanSteps(markdown);
  const position = steps.findIndex((step) => step.id === stepId);
  const target = position + direction;
  if (position === -1 || target < 0 || target >= steps.length) return markdown;
  return applyToSteps(markdown, (stepLines) => {
    const next = [...stepLines];
    [next[position], next[target]] = [next[target], next[position]];
    return next;
  });
}

export function removeStep(markdown: string, stepId: string): string {
  const steps = parsePlanSteps(markdown);
  const target = steps.find((step) => step.id === stepId);
  if (!target) return markdown;
  const index = steps.indexOf(target);
  return applyToSteps(markdown, (stepLines) => stepLines.filter((_line, position) => position !== index));
}

export function addStep(markdown: string, label: string): string {
  const clean = label.trim();
  if (!clean) return markdown;
  const lines = toLines(markdown);
  const steps = parsePlanSteps(markdown);
  const insertAt = steps.length > 0 ? steps[steps.length - 1].line + 1 : findSectionInsertIndex(lines);
  lines.splice(insertAt, 0, `${steps.length + 1}. ${clean}`);
  return applyToSteps(lines.join("\n"), (stepLines) => stepLines);
}

function findSectionInsertIndex(lines: string[]): number {
  let inSection = false;
  for (let index = 0; index < lines.length; index++) {
    const heading = HEADING.exec(lines[index]);
    if (heading) {
      if (inSection) return index;
      inSection = TASK_SECTION.test(heading[1]);
      if (!inSection) continue;
      continue;
    }
    if (inSection && lines[index].trim() === "") continue;
  }
  return lines.length;
}

export interface PartialApproval {
  markdown: string;
  approved: number;
  total: number;
}

export function buildPartialApproval(markdown: string): PartialApproval {
  const steps = parsePlanSteps(markdown);
  const approved = steps.filter((step) => step.included).length;
  if (steps.length === 0) return { markdown, approved: 0, total: 0 };
  const kept = applyToSteps(markdown, (stepLines) =>
    stepLines.filter((_line, position) => steps[position]?.included)
  );
  const note =
    approved === steps.length
      ? ""
      : `\n> Aprobación parcial: ${approved} de ${steps.length} pasos autorizados. Los no incluidos quedan fuera de alcance.\n`;
  return { markdown: `${kept.trimEnd()}${note}`, approved, total: steps.length };
}
