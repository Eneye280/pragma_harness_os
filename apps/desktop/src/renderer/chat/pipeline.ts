import type { HarnessPhase, HarnessStepStatus } from "@shared/chat-events";

export interface TimelineNode {
  phase: HarnessPhase;
  index: number;
  title: string;
  hint: string;
  status: HarnessStepStatus | "pending";
  detail?: string;
}

export const PIPELINE_PHASES: HarnessPhase[] = [
  "classify",
  "rules",
  "skills",
  "context",
  "plugins",
  "pre-gates",
  "plan",
  "agent",
];

/** Título directo de cada fase (qué es). */
export const PHASE_TITLE: Record<HarnessPhase, string> = {
  classify: "Clasificar la petición",
  rules: "Compilar reglas",
  skills: "Cargar skills",
  context: "Reunir contexto y RAG",
  plugins: "Aplicar plugins",
  "pre-gates": "Pasar los pre-gates",
  plan: "Proponer plan",
  agent: "Ejecutar el agente",
};

/** Una línea de qué hace la fase (por qué existe). */
export const PHASE_HINT: Record<HarnessPhase, string> = {
  classify: "El clasificador determinista decide el dominio y el modo del run.",
  rules: "Se compilan las reglas del dominio en un bloque estable.",
  skills: "Las skills relevantes se seleccionan y compilan en un bloque.",
  context: "Se prefetchean archivos, se buscan coincidencias RAG y se arma el contexto.",
  plugins: "Plugins activos revisan la petición y pueden añadir o bloquear pasos.",
  "pre-gates": "Controles antes del agente: secrets, presupuesto y esquema.",
  plan: "Si la tarea es grande, se propone un plan para aprobación.",
  agent: "El agente ejecuta con el contexto ya compilado y reporta tool calls.",
};

export interface PipelineStepInput {
  phase: HarnessPhase;
  status: HarnessStepStatus;
  label: string;
  detail?: string;
}

/**
 * Construye la línea de tiempo: las fases ya reportadas con su estado real, más
 * las pendientes hasta la fase activa, para que el pipeline se lea completo.
 */
export function buildTimeline(steps: PipelineStepInput[]): TimelineNode[] {
  return PIPELINE_PHASES.map((phase, index) => {
    const reported = steps.find((step) => step.phase === phase);
    const status: TimelineNode["status"] = reported ? reported.status : "pending";
    return {
      phase,
      index,
      title: PHASE_TITLE[phase],
      hint: PHASE_HINT[phase],
      status,
      detail: reported?.detail ?? reported?.label,
    };
  });
}

export function timelineProgress(nodes: TimelineNode[]): number {
  if (nodes.length === 0) return 0;
  const done = nodes.filter((node) => node.status === "done").length;
  return Math.round((done / nodes.length) * 100);
}
