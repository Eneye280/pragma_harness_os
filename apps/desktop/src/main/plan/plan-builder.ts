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

export type Stack = "web" | "unity" | "backend" | "engine" | "gbl" | "nexus" | "generic";

const STACK_PATTERNS: Array<{ stack: Stack; pattern: RegExp }> = [
  { stack: "unity", pattern: /\b(unity|monobehaviour|c#|prefab|ugui|uxml|scriptableobject)\b/i },
  { stack: "web", pattern: /\b(html|css|javascript|p[áa]gina web|landing|calculadora|minijuego|juego|canvas|webgl|dom|frontend|navegador|browser)\b/i },
  { stack: "backend", pattern: /\b(api|endpoint|fastify|supabase|jwt|rest|servidor|server|sql|backend)\b/i },
  { stack: "engine", pattern: /\b(vulkan|silk|ecs|\.net|nativeaot|render|shader)\b/i },
  { stack: "gbl", pattern: /\b(gbl|sg-sst|aprendizaje|pedag[oó]gico|narrativ)\b/i },
  { stack: "nexus", pattern: /\b(nexus|firebase|capacitaci[oó]n)\b/i },
];

export function detectStack(message: string, intent: PlanIntent): Stack {
  for (const entry of STACK_PATTERNS) if (entry.pattern.test(message)) return entry.stack;
  const domain = intent.domain as Stack;
  return (["unity", "backend", "engine", "gbl", "nexus"] as Stack[]).includes(domain) ? domain : "generic";
}

function filesForStack(stack: Stack, message: string): string[] {
  if (stack === "web") {
    return ["index.html", "styles.css", "app.js"];
  }
  if (stack === "unity") {
    return ["Assets/Scripts/Game.cs", "Assets/Scripts/GameTests.cs"];
  }
  void message;
  return [];
}

function stackLabel(stack: Stack): string {
  return { web: "Web (HTML/CSS/JS)", unity: "Unity (C#)", backend: "Backend (TS)", engine: "Engine (.NET)", gbl: "GBL", nexus: "Nexus", generic: "General" }[stack];
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

  if (files.size === 0) {
    const stackFiles = filesForStack(detectStack(message, intent), message);
    for (const file of stackFiles) files.add(file);
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

const STACK_STEPS: Record<Stack, string[]> = {
  web: [
    "Crear la estructura HTML con los elementos de la interfaz pedidos",
    "Escribir el CSS con el layout y estilos",
    "Implementar la lógica en JavaScript (estado, eventos, validaciones)",
    "Abrir index.html en el navegador y probar el flujo completo",
  ],
  unity: [
    "Crear los scripts C# por responsabilidad única (input, lógica, UI)",
    "Configurar la escena/prefabs y sus referencias",
    "Probar en PlayMode el comportamiento pedido",
  ],
  backend: [
    "Definir el contrato (ruta, input, output) con esquema validado",
    "Implementar el handler y la lógica de dominio",
    "Cubrir con tests el caso feliz y los errores",
  ],
  engine: [
    "Definir la estructura de datos del sistema en el ECS",
    "Implementar el sistema y su integración con el render/update",
    "Validar con captura y benchmark",
  ],
  gbl: [
    "Alinear la mecánica con el objetivo de aprendizaje",
    "Implementar la escena y el feedback",
    "Registrar telemetría de desempeño",
  ],
  nexus: [
    "Definir la experiencia y sus métricas",
    "Implementar en Unity/Firebase",
    "Probar el flujo de extremo a extremo",
  ],
  generic: ["Implementar el cambio solicitado en los archivos indicados"],
};

const STACK_CHECKS: Record<Stack, string[]> = {
  web: ["La página abre sin errores en consola", "Los botones/campos responden a lo pedido", "Sin recursos externos rotos"],
  unity: ["PlayMode sin excepciones", "La mecánica hace lo pedido", "Sin referencias nulas"],
  backend: ["tests en verde (caso feliz + error)", "input validado (sin SQL string)", "sin secretos en el diff"],
  engine: ["compila y corre", "captura válida", "sin regresiones de rendimiento"],
  gbl: ["el objetivo pedagógico se cumple", "feedback correcto", "telemetría registrada"],
  nexus: ["flujo completo probado", "métricas registradas", "sin errores en runtime"],
  generic: ["el cambio es lo pedido, ni más ni menos", "sin secretos ni console.log en el diff", "no hay TODOs sin issue"],
};

export function buildPlanMarkdown(message: string, intent: PlanIntent, files: string[]): string {
  const stepsByNeed: Record<string, string> = {
    "tdd-workflow": "Escribir el test en rojo y luego la implementación mínima",
    "security-review": "Revisar validación de entrada y exposición de datos",
    "api-design": "Definir el contrato del endpoint y sus esquemas",
    "backend-patterns": "Aplicar los patrones de backend del dominio",
    "vulkan-master": "Respetar el pipeline Vulkan y el contrato de recursos",
    "verification-loop": "Correr la verificación de 6 fases",
  };
  const stack = detectStack(message, intent);
  const needSteps = intent.needs.map((need) => stepsByNeed[need] ?? `Aplicar ${need}: ${need}`);
  const steps = [...STACK_STEPS[stack], ...needSteps, "Correr los gates post-agente (build, typecheck, lint, tests, security)"];

  const asks = message.trim().replace(/\s+/g, " ").slice(0, 160);
  const scopeNote = "Solo se hará lo pedido; cualquier extra se propone en «Sugerencias», no se ejecuta.";

  return [
    `# Plan — ${message.slice(0, 70)}`,
    "",
    "## Objetivo",
    message,
    "",
    "## Pensamiento",
    `- Petición: “${asks}”`,
    `- Stack detectado: ${stackLabel(stack)}`,
    `- Alcance: ${scopeNote}`,
    `- Supuesto: ${files.length > 0 ? `se tocarán ${files.length} archivo(s) listados abajo` : "archivos por confirmar"}.`,
    `- Riesgo principal: ${stack === "web" ? "errores de JS en runtime que solo se ven al abrir la página" : stack === "unity" ? "referencias de escena rotas" : "regresiones en tests existentes"}.`,
    "",
    "## Intención",
    `${intent.domain} · ${intent.type} · effort ${intent.effort} · needs: ${intent.needs.join(", ") || "ninguna"}`,
    "",
    "## Pasos",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Archivos",
    ...files.map((file) => `- ${file}`),
    "",
    "## Verificación",
    ...STACK_CHECKS[stack].map((check) => `- ${check}`),
    ...(stack === "web" ? ["- Abrir el HTML en el navegador para probar de verdad"] : []),
    "",
    "## Sugerencias (no se ejecutan sin tu OK)",
    "- Añadir tests automatizados si el stack lo permite.",
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
