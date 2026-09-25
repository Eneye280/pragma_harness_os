import { describe, it, expect } from "vitest";
import { classify } from "../classifier";

describe("Intent Classifier — deterministic >80% no LLM", () => {
  const cases: Array<{ msg: string; wp: string; expect: Partial<ReturnType<typeof classify>> }> = [
    { msg: "agrega auth con OAuth al backend", wp: "/tmp/pragma_backend", expect: { domain: "backend", type: "feature", needs: expect.arrayContaining(["security-review"]) } },
    { msg: "fix bug en el login no redirige", wp: "/tmp/pragma_backend", expect: { domain: "backend", type: "fix", effort: "low" } },
    { msg: "implementa render Vulkan con shader", wp: "/tmp/pragma_engine", expect: { domain: "engine", type: "feature", needs: expect.arrayContaining(["vulkan-master"]) } },
    { msg: "agrega modulo de lobby en unity con addressables", wp: "/tmp/pragma-unity-2.0", expect: { domain: "unity", type: "feature" } },
    { msg: "refactoriza el sistema de auth completo", wp: "/tmp/pragma_backend", expect: { type: "refactor", effort: "high" } },
    { msg: "corrige typo en README", wp: "/tmp/general", expect: { type: "fix", effort: "low" } },
    { msg: "documenta el harness OS handbook", wp: "/tmp/general", expect: { type: "docs" } },
    { msg: "agrega endpoint /users con paginacion", wp: "/tmp/pragma_backend", expect: { needs: expect.arrayContaining(["api-design"]) } },
    { msg: "valida coverage al 80% con tests", wp: "/tmp/general", expect: { type: "qa", needs: expect.arrayContaining(["verification-loop"]) } },
    { msg: "crea sistema de misiones completo con backend y frontend", wp: "/tmp/pragma-unity-2.0", expect: { effort: "high" } },
    { msg: "fix crash en Vulkan al crear swapchain", wp: "/tmp/pragma_engine", expect: { domain: "engine", type: "fix" } },
    { msg: "add new dialogue system with choices", wp: "/tmp/pragma-unity-2.0", expect: { domain: "unity" } },
    { msg: "agrega autenticacion con supabase y zod", wp: "/tmp/pragma_backend", expect: { needs: expect.arrayContaining(["backend-patterns"]) } },
    { msg: "implementa gamificacion para nexus", wp: "/tmp/nexus_lab_unity", expect: { domain: "nexus" } },
    { msg: "crea curso GBL sobre riesgo psicosocial", wp: "/tmp/gbl", expect: { domain: "gbl" } },
    { msg: "hola", wp: "/tmp/general", expect: { domain: "general", type: "feature" } },
    { msg: "agrega validacion de input con zod en todos los endpoints", wp: "/tmp/pragma_backend", expect: { needs: expect.arrayContaining(["api-design"]) } },
    { msg: "refactor shader pipeline para GPU", wp: "/tmp/pragma_engine", expect: { type: "refactor", needs: expect.arrayContaining(["vulkan-master"]) } },
    { msg: "fix memory leak en ECS", wp: "/tmp/pragma_engine", expect: { type: "fix" } },
    { msg: "documenta API con OpenAPI 3.1", wp: "/tmp/pragma_backend", expect: { type: "docs" } },
  ];

  for (const { msg, wp, expect: exp } of cases) {
    it(`"${msg.slice(0, 40)}" -> ${JSON.stringify(exp)}`, () => {
      const intent = classify(msg, wp);
      if (exp.domain) expect(intent.domain).toBe(exp.domain);
      if (exp.type) expect(intent.type).toBe(exp.type);
      if (exp.effort) expect(intent.effort).toBe(exp.effort);
      if (exp.needs) expect(intent.needs).toEqual(exp.needs);
      expect(intent.confidence).toBeGreaterThan(0);
      expect(intent.confidence).toBeLessThanOrEqual(0.95);
    });
  }

  it("uses workspacePath to boost domain", () => {
    const a = classify("hola", "/tmp/pragma_backend");
    expect(a.domain).toBe("backend");
    const b = classify("hola", "/tmp/pragma_engine");
    expect(b.domain).toBe("engine");
  });

  it("fallback adds confidence when low", async () => {
    const { classifyWithFallback } = await import("../classifier");
    const res = await classifyWithFallback("hola", "/tmp/general");
    expect(res.confidence).toBeGreaterThan(0.35);
  });
});
