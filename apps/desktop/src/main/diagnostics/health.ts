import { redactSecrets } from "../tools/types";

export type HealthStatus = "ok" | "warn" | "fail";

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface DiagnosticsReport {
  generatedAt: number;
  checks: HealthCheck[];
  report: string;
}

export interface DiagnosticsProbes {
  version: () => string;
  provider: () => { name: string; hasKey: boolean; model: string };
  sqlite: () => { available: boolean; detail: string };
  server: () => Promise<{ reachable: boolean; detail: string }>;
  docker: () => Promise<{ available: boolean; detail: string }>;
  rag: () => { size: number; excludes: number };
  git: () => Promise<{ clean: boolean; detail: string }>;
}

function status(ok: boolean, warn = false): HealthStatus {
  if (ok) return "ok";
  return warn ? "warn" : "fail";
}

export async function collectDiagnostics(probes: DiagnosticsProbes): Promise<DiagnosticsReport> {
  const checks: HealthCheck[] = [];
  const version = probes.version();
  checks.push({ id: "version", label: "Versión", status: "ok", detail: version });

  const provider = probes.provider();
  checks.push({
    id: "provider",
    label: "Provider",
    status: status(provider.name === "mock" || provider.hasKey, true),
    detail: `${provider.name} · ${provider.model} · ${provider.hasKey ? "apiKey configurada" : "sin apiKey"}`,
  });

  const sqlite = probes.sqlite();
  checks.push({ id: "sqlite", label: "SQLite", status: status(sqlite.available, true), detail: sqlite.detail });

  const server = await probes.server().catch((error) => ({ reachable: false, detail: error instanceof Error ? error.message : "unreachable" }));
  checks.push({ id: "server", label: "Servidor Hono", status: status(server.reachable, true), detail: server.detail });

  const docker = await probes.docker().catch((error) => ({ available: false, detail: error instanceof Error ? error.message : "unavailable" }));
  checks.push({ id: "docker", label: "Docker", status: status(docker.available, true), detail: docker.detail });

  const rag = probes.rag();
  checks.push({ id: "rag", label: "Índice RAG", status: status(rag.size > 0, true), detail: `${rag.size} documentos · ${rag.excludes} exclusiones` });

  const git = await probes.git().catch((error) => ({ clean: false, detail: error instanceof Error ? error.message : "no repo" }));
  checks.push({ id: "git", label: "Git", status: status(git.clean, true), detail: git.detail });

  return { generatedAt: Date.now(), checks, report: buildReport(checks) };
}

export function buildReport(checks: HealthCheck[], generatedAt = Date.now()): string {
  const lines = [`Pragma Harness OS · diagnóstico`, `generado: ${new Date(generatedAt).toISOString()}`, ""];
  for (const check of checks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`);
  }
  return redactSecrets(lines.join("\n"));
}

export function summarize(checks: HealthCheck[]): { ok: number; warn: number; fail: number } {
  return {
    ok: checks.filter((check) => check.status === "ok").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length,
  };
}
