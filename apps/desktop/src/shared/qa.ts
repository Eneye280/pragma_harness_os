export const QA_SCRIPT_ORDER = ["lint", "typecheck", "test", "build"] as const;

export function orderedScriptNames(scripts: Record<string, string> | undefined): string[] {
  const map = scripts ?? {};
  return QA_SCRIPT_ORDER.filter((script) => typeof map[script] === "string");
}

export type QaStep =
  | { action: "request"; method: "GET" | "POST"; path: string; expectStatus?: number }
  | { action: "expectText"; text: string }
  | { action: "click"; selector: string }
  | { action: "type"; selector: string; value: string }
  | { action: "wait"; ms: number };

export interface QaScenario {
  id: string;
  name: string;
  steps: QaStep[];
  requiresUi?: boolean;
}

export interface QaStepResult {
  index: number;
  step: QaStep;
  status: "pass" | "fail" | "skipped";
  detail: string;
}

export interface QaRunResult {
  scenarioId: string;
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  results: QaStepResult[];
}

export function validateScenario(scenario: QaScenario): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!scenario.id.trim()) errors.push("falta id");
  if (!scenario.name.trim()) errors.push("falta name");
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) errors.push("sin pasos");
  scenario.steps?.forEach((step, index) => {
    if (step.action === "request" && !step.path.startsWith("/")) errors.push(`paso ${index}: path debe empezar con /`);
    if ((step.action === "click" || step.action === "type") && step.selector.trim().length === 0) errors.push(`paso ${index}: selector vacío`);
    if (step.action === "wait" && step.ms < 0) errors.push(`paso ${index}: ms negativo`);
  });
  return { ok: errors.length === 0, errors };
}

export const HEALTH_SCENARIO: QaScenario = {
  id: "health",
  name: "Health del server Hono",
  steps: [
    { action: "request", method: "GET", path: "/health", expectStatus: 200 },
    { action: "expectText", text: "harness:ready" },
  ],
};

export interface QaRunnerDeps {
  baseUrl?: string;
  fetchImpl?: (url: string, init?: { method?: string }) => Promise<{ status: number; text: () => Promise<string> }>;
}

export async function runScenario(scenario: QaScenario, deps: QaRunnerDeps = {}): Promise<QaRunResult> {
  const validation = validateScenario(scenario);
  if (!validation.ok) {
    return { scenarioId: scenario.id, ok: false, passed: 0, failed: validation.errors.length, skipped: 0, results: validation.errors.map((detail, index) => ({ index, step: { action: "wait", ms: 0 }, status: "fail" as const, detail })) };
  }
  const fetchImpl = deps.fetchImpl ?? (fetch as unknown as QaRunnerDeps["fetchImpl"])!;
  const baseUrl = deps.baseUrl ?? "http://127.0.0.1:4096";
  const results: QaStepResult[] = [];
  let lastBody = "";

  for (const [index, step] of scenario.steps.entries()) {
    if (step.action === "click" || step.action === "type") {
      results.push({ index, step, status: "skipped", detail: "requiere UI (se ejecuta por CDP en el runner visual)" });
      continue;
    }
    if (step.action === "wait") {
      results.push({ index, step, status: "pass", detail: `espera ${step.ms}ms` });
      continue;
    }
    if (step.action === "expectText") {
      const found = lastBody.includes(step.text);
      results.push({ index, step, status: found ? "pass" : "fail", detail: found ? `encontrado "${step.text}"` : `no se encontró "${step.text}"` });
      continue;
    }
    try {
      const url = step.path.startsWith("http") ? step.path : `${baseUrl}${step.path}`;
      const response = await fetchImpl(url, { method: step.method });
      lastBody = await response.text();
      const expected = step.expectStatus ?? 200;
      results.push({ index, step, status: response.status === expected ? "pass" : "fail", detail: `http ${response.status} (esperado ${expected})` });
    } catch (error) {
      results.push({ index, step, status: "fail", detail: error instanceof Error ? error.message : "request failed" });
    }
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  return {
    scenarioId: scenario.id,
    ok: failed === 0,
    passed,
    failed,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}

export interface QaProjectStep {
  name: string;
  ok: boolean;
  detail: string;
  durationMs?: number;
}

export interface QaProjectReport {
  ok: boolean;
  stack: "node" | "web" | "unknown";
  steps: QaProjectStep[];
  consoleErrors: string[];
  screenshotPath?: string;
  screenshotDataUrl?: string;
}