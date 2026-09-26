import { describe, it, expect } from "vitest";
import { buildPlan, buildPlanMarkdown, extractFilesFromMarkdown, extractPlanFiles, recompilePlan, shouldProposePlan } from "../plan-builder";
import { parseTasks } from "../../../shared/task-list";
import type { PlanIntent } from "../../../shared/plan";

const featureIntent = (effort: string): PlanIntent => ({ domain: "backend", type: "feature", effort, needs: ["tdd-workflow", "api-design"] });

describe("plan builder", () => {
  it("proposes a plan for feature work at medium/high effort or with significant keywords", () => {
    expect(shouldProposePlan(featureIntent("medium"), "agrega algo")).toBe(true);
    expect(shouldProposePlan(featureIntent("high"), "agrega algo")).toBe(true);
    expect(shouldProposePlan(featureIntent("low"), "crea un archivo de nota")).toBe(false);
    expect(shouldProposePlan(featureIntent("low"), "agrega un módulo de reportes")).toBe(true);
    expect(shouldProposePlan({ ...featureIntent("high"), type: "fix" }, "arregla algo")).toBe(false);
  });

  it("produces markdown whose plan steps parse as message tasks", () => {
    const markdown = buildPlanMarkdown("agrega un modulo de usuarios con endpoints y permisos", featureIntent("medium"), ["src/modules/usuarios/index.ts"]);
    expect(parseTasks(markdown).length).toBeGreaterThan(0);
  });

  it("extracts mentioned files and derives module paths", () => {
    const files = extractPlanFiles("agrega src/modules/auth/service.ts y crea el módulo reportes", featureIntent("medium"));
    expect(files).toContain("src/modules/auth/service.ts");
    expect(files).toContain("src/modules/reportes/index.ts");
    expect(files).toContain("src/modules/reportes/reportes.test.ts");
  });

  it("skips stopwords between the module keyword and its name", () => {
    const files = extractPlanFiles("agrega un modulo de reportes", featureIntent("medium"));
    expect(files).toContain("src/modules/reportes/index.ts");
    expect(files).not.toContain("src/modules/de/index.ts");
  });

  it("falls back to a domain default when no file is mentioned", () => {
    expect(extractPlanFiles("agrega auth", featureIntent("medium"))).toEqual(["src/modules/index.ts"]);
  });

  it("builds a plan with objective, intent, steps and files", () => {
    const markdown = buildPlanMarkdown("agrega módulo de reportes", featureIntent("medium"), ["src/modules/reportes/index.ts"]);
    expect(markdown).toContain("## Objetivo");
    expect(markdown).toContain("## Pasos");
    expect(markdown).toContain("## Archivos");
    expect(markdown).toContain("- src/modules/reportes/index.ts");
    expect(markdown).toContain("backend · feature · effort medium");
  });

  it("recompiles a revised plan and marks it as revised", () => {
    const revised = recompilePlan("# Plan revisado\n\n## Archivos\n- src/a.ts\n- src/b.ts", "sess-1", featureIntent("medium"));
    expect(revised.revised).toBe(true);
    expect(revised.title).toBe("Plan revisado");
    expect(revised.files).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("builds a full proposal carrying the intent", () => {
    const plan = buildPlan("agrega módulo de reportes", featureIntent("medium"), "sess-9");
    expect(plan.sessionId).toBe("sess-9");
    expect(plan.intent.domain).toBe("backend");
    expect(plan.files.length).toBeGreaterThan(0);
    expect(extractFilesFromMarkdown(plan.markdown).length).toBeGreaterThan(0);
  });

  it("adapts the plan to a web request (specific files and thinking)", () => {
    const markdown = buildPlanMarkdown("crea un minijuego de saltar y recoger monedas en 3d, en html", featureIntent("medium"), ["index.html", "styles.css", "app.js"]);
    expect(markdown).toContain("## Pensamiento");
    expect(markdown).toContain("Web (HTML/CSS/JS)");
    expect(markdown).toContain("## Sugerencias");
    expect(markdown).toContain("Solo se hará lo pedido");
    expect(markdown).toContain("Abrir el HTML en el navegador");
  });

  it("derives web files when the request is a webpage without explicit paths", () => {
    const files = extractPlanFiles("crea una calculadora web", featureIntent("medium"));
    expect(files).toContain("index.html");
    expect(files).toContain("styles.css");
    expect(files).toContain("app.js");
  });
});
