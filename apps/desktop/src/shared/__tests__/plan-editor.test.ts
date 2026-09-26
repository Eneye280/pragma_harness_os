import { describe, expect, it } from "vitest";
import { addStep, buildPartialApproval, moveStep, parsePlanSteps, removeStep, setStepIncluded } from "../plan-editor";

const PLAN = [
  "# Plan — demo",
  "## Pasos",
  "1. Crear el controlador",
  "2. Añadir tests",
  "3. Documentar",
  "",
  "## Archivos",
  "- src/a.ts",
].join("\n");

describe("plan-editor", () => {
  it("parses the steps of a plan section", () => {
    const steps = parsePlanSteps(PLAN);
    expect(steps.map((step) => step.label)).toEqual(["Crear el controlador", "Añadir tests", "Documentar"]);
    expect(steps.every((step) => step.included)).toBe(true);
  });

  it("excludes and re-includes a step, renumbering the rest", () => {
    const excluded = setStepIncluded(PLAN, "s2", false);
    expect(excluded).toContain("2. [omitido] Añadir tests");
    expect(parsePlanSteps(excluded)[1].included).toBe(false);
    const restored = setStepIncluded(excluded, "s2", true);
    expect(restored).toContain("2. Añadir tests");
  });

  it("reorders steps", () => {
    const moved = moveStep(PLAN, "s3", -1);
    expect(moved.indexOf("2. Documentar")).toBeLessThan(moved.indexOf("3. Añadir tests"));
  });

  it("removes and adds steps", () => {
    const removed = removeStep(PLAN, "s1");
    expect(parsePlanSteps(removed).map((step) => step.label)).toEqual(["Añadir tests", "Documentar"]);
    const added = addStep(removed, "Desplegar");
    expect(parsePlanSteps(added).map((step) => step.label)).toEqual(["Añadir tests", "Documentar", "Desplegar"]);
  });

  it("builds a partial approval that drops omitted steps", () => {
    const partial = buildPartialApproval(setStepIncluded(PLAN, "s2", false));
    expect(partial.approved).toBe(2);
    expect(partial.total).toBe(3);
    expect(partial.markdown).toContain("Crear el controlador");
    expect(partial.markdown).toContain("Documentar");
    expect(partial.markdown).not.toContain("Añadir tests");
    expect(partial.markdown).toContain("Aprobación parcial: 2 de 3");
  });

  it("returns the full markdown when everything is approved", () => {
    const full = buildPartialApproval(PLAN);
    expect(full.approved).toBe(3);
    expect(full.markdown).not.toContain("Aprobación parcial");
  });
});
