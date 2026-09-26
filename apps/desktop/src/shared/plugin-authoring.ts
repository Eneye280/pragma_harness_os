export const PLUGIN_STAGES = ["pre-classify", "pre-compile", "pre-agent", "post-agent"] as const;
export type CustomPluginStage = (typeof PLUGIN_STAGES)[number];

export const PLUGIN_ACTIONS = ["block", "transform", "inject-skill"] as const;
export type CustomPluginAction = (typeof PLUGIN_ACTIONS)[number];

export interface CustomPluginDef {
  name: string;
  description: string;
  stage: CustomPluginStage;
  priority: number;
  match: string;
  action: CustomPluginAction;
  message: string;
  skillName: string;
}

export interface CustomPluginValidation {
  ok: boolean;
  errors: string[];
}

export function createCustomPluginTemplate(name: string): CustomPluginDef {
  return {
    name,
    description: "",
    stage: "pre-agent",
    priority: 50,
    match: "",
    action: "block",
    message: "",
    skillName: "",
  };
}

export function validateCustomPlugin(def: CustomPluginDef): CustomPluginValidation {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(def.name.trim())) errors.push("name debe ser kebab-case (a-z, 0-9, -)");
  if (!PLUGIN_STAGES.includes(def.stage)) errors.push("stage inválido");
  if (!PLUGIN_ACTIONS.includes(def.action)) errors.push("action inválida");
  if (!Number.isFinite(def.priority)) errors.push("priority debe ser numérico");
  if (def.match.trim()) {
    try {
      new RegExp(def.match, "i");
    } catch {
      errors.push("match no es una expresión regular válida");
    }
  } else {
    errors.push("define el patrón match");
  }
  if (def.action === "block" && !def.message.trim()) errors.push("action block requiere message");
  if (def.action === "transform" && !def.message.trim()) errors.push("action transform requiere message");
  if (def.action === "inject-skill" && !def.skillName.trim()) errors.push("action inject-skill requiere skillName");
  return { ok: errors.length === 0, errors };
}

export function customPluginDefToJson(def: CustomPluginDef): string {
  return `${JSON.stringify(def, null, 2)}\n`;
}

export function parseCustomPluginJson(json: unknown): CustomPluginDef | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Partial<CustomPluginDef>;
  if (typeof raw.name !== "string" || typeof raw.match !== "string") return null;
  return {
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    stage: (PLUGIN_STAGES as readonly string[]).includes(raw.stage ?? "") ? (raw.stage as CustomPluginStage) : "pre-agent",
    priority: Number.isFinite(raw.priority) ? (raw.priority as number) : 50,
    match: raw.match,
    action: (PLUGIN_ACTIONS as readonly string[]).includes(raw.action ?? "") ? (raw.action as CustomPluginAction) : "block",
    message: typeof raw.message === "string" ? raw.message : "",
    skillName: typeof raw.skillName === "string" ? raw.skillName : "",
  };
}

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
}

export function validateProjectTasks(tasks: ProjectTask[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task.id.trim()) errors.push("toda tarea necesita id");
    if (ids.has(task.id)) errors.push(`id duplicado: ${task.id}`);
    ids.add(task.id);
    if (!task.title.trim()) errors.push(`la tarea ${task.id} necesita título`);
  }
  return { ok: errors.length === 0, errors };
}
