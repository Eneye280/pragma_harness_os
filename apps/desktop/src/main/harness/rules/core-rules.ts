export const CORE_RULES: Record<string, string> = {
  "G1-respetar-solicitud": "G1 Respetar solicitud: cumple exactamente lo pedido, no añadas scope no solicitado, no asumas.",
  "G2-no-asumir": "G2 No asumir: si falta info, pregunta o busca evidencia en disco/docs, no inventes APIs.",
  "G3-releer-reglas": "G3 Releer reglas del disco al inicio de cada tarea.",
  "G4-analisis-visual": "G4 Análisis visual: toda tarea TIPO_VISUAL requiere captura real + diff de píxeles.",
  "G5-nombres-descriptivos": "G5 Nombres descriptivos: prohibido a,s,x,temp,data,flag,i suelto; usa nombres con propósito.",
  "G6-execution-lifecycle": "G6 Execution lifecycle: analiza → planifica → implementa → verifica → documenta.",
  "G7-policy-enforcement": "G7 Policy enforcement: respeta permisos edit/ask y bloquea secretos.",
  "G8-herencia-automatica": "G8 Herencia automática: hereda reglas del workspace y AGENTS.md si existe.",
  "G9-idioma-espanol": "G9 Idioma: responde en español, commits en inglés imperativo.",
  "G10-cerrar-sin-pendientes": "G10 Cerrar sin pendientes: no dejes TODOs sin issue, cada task cierra con gate.",
};

export const STYLE_RULES: Record<string, string> = {
  "no-comments-in-body": "Estilo: nunca comentarios dentro de cuerpo de métodos ni sobre variables; solo summary en clase/métodos públicos.",
  "descriptive-names": "Estilo: variables/métodos/clases con nombre enfocado a propósito, prefijo is/has para bool, verbo para método.",
  "mcp-first": "MCP-first: usa tools MCP (penpot, supabase, desktop, inspector) antes que alternativas manuales.",
  "docs-first": "Docs-first: consulta documentación oficial ANTES de asumir APIs.",
};

export const DOMAIN_RULES: Record<string, string> = {
  backend: "Dominio backend: Fastify 5 + Supabase + TypeScript 6 + Zod v4 + JWT + HMAC; valida input, no SQL string.",
  engine: "Dominio engine: .NET 9 + Silk.NET + Vulkan 1.3 + ECS + NativeAOT; valida GPU con PPM capture.",
  unity: "Dominio unity: Unity 6000.6 + Pragma Framework 2.0 + addressables; un script por componente.",
  nexus: "Dominio nexus: Unity + Firebase Functions + capacitación empresarial; gamificación con métricas.",
  gbl: "Dominio gbl: GBL Studio fases 0-8 + SG-SST + narrativa; trazabilidad E0xx.",
  general: "Dominio general: aplica G1-G10 + estilo sin dominio específico.",
};
