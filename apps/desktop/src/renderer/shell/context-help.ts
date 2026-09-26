export type ContextSectionKey = "agent" | "skills" | "rag" | "files" | "tokens" | "rules" | "instincts";

export interface ContextSectionHelp {
  title: string;
  description: string;
  action?: string;
}

/** Qué es y para qué sirve cada bloque del Context (una línea directa). */
export const CONTEXT_HELP: Record<ContextSectionKey, ContextSectionHelp> = {
  agent: {
    title: "Agente",
    description: "Quién ejecuta este run. El harness lo elige por dominio salvo que fijes uno.",
    action: "Cambiar en Settings",
  },
  skills: {
    title: "Skills",
    description: "Skills resueltas para este run y compiladas en un bloque estable.",
    action: "Nueva skill",
  },
  rag: {
    title: "RAG",
    description: "Coincidencias del índice semántico del proyecto que entran al contexto.",
    action: "Reindexar",
  },
  files: {
    title: "Archivos",
    description: "Archivos prefetcheados por relevancia antes de llamar al agente.",
  },
  tokens: {
    title: "Tokens",
    description: "Presupuesto de contexto usado frente al límite configurado.",
  },
  rules: {
    title: "Reglas",
    description: "Reglas del dominio compiladas que restringen al agente.",
  },
  instincts: {
    title: "Instincts",
    description: "Aprendizajes de runs anteriores con confianza suficiente para aplicarse.",
  },
};

export function contextSections(): ContextSectionKey[] {
  return ["agent", "skills", "rag", "files", "tokens", "rules", "instincts"];
}
