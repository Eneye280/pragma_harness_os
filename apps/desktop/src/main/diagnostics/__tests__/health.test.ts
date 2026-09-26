import { describe, expect, it } from "vitest";
import { buildReport, collectDiagnostics, summarize, type DiagnosticsProbes } from "../health";

function probes(overrides: Partial<DiagnosticsProbes> = {}): DiagnosticsProbes {
  return {
    version: () => "1.0.1",
    provider: () => ({ name: "deepseek", hasKey: true, model: "deepseek-chat" }),
    sqlite: () => ({ available: false, detail: "json fallback" }),
    server: async () => ({ reachable: true, detail: "harness:ready" }),
    docker: async () => ({ available: false, detail: "daemon no disponible" }),
    rag: () => ({ size: 12, excludes: 1 }),
    git: async () => ({ clean: true, detail: "development · 0 cambios" }),
    ...overrides,
  };
}

describe("diagnostics health", () => {
  it("collects real checks with statuses", async () => {
    const report = await collectDiagnostics(probes());
    expect(report.checks.map((check) => check.id)).toEqual(["version", "provider", "sqlite", "server", "docker", "rag", "git"]);
    expect(report.checks.find((check) => check.id === "server")?.status).toBe("ok");
    expect(report.checks.find((check) => check.id === "docker")?.status).toBe("warn");
    expect(summarize(report.checks)).toEqual({ ok: 5, warn: 2, fail: 0 });
  });

  it("flags a failing check", async () => {
    const report = await collectDiagnostics(probes({ server: async () => ({ reachable: false, detail: "sin respuesta" }) }));
    expect(report.checks.find((check) => check.id === "server")?.status).toBe("warn");
    const missingKey = await collectDiagnostics(probes({ provider: () => ({ name: "openai", hasKey: false, model: "gpt" }) }));
    expect(missingKey.checks.find((check) => check.id === "provider")?.status).toBe("warn");
  });

  it("builds a report without secrets", () => {
    const report = buildReport([
      { id: "provider", label: "Provider", status: "ok", detail: "key sk-abcdefgh12345678 configurada" },
    ]);
    expect(report).toContain("[OK] Provider");
    expect(report).not.toContain("sk-abcdefgh12345678");
    expect(report).toContain("[REDACTED]");
  });
});
