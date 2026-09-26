import { describe, expect, it } from "vitest";
import { HEALTH_SCENARIO, runScenario, validateScenario, type QaScenario } from "../qa";

const fetchReturning = (status: number, body: string) => async () => ({ status, text: async () => body });

describe("internal QA runner", () => {
  it("validates scenarios", () => {
    expect(validateScenario(HEALTH_SCENARIO).ok).toBe(true);
    const bad: QaScenario = { id: "", name: "", steps: [{ action: "request", method: "GET", path: "health" }] };
    const result = validateScenario(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("path debe empezar"))).toBe(true);
  });

  it("runs request + expectText steps", async () => {
    const result = await runScenario(HEALTH_SCENARIO, { fetchImpl: fetchReturning(200, '{"status":"harness:ready"}') });
    expect(result.ok).toBe(true);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("fails on wrong status or missing text", async () => {
    const result = await runScenario(HEALTH_SCENARIO, { fetchImpl: fetchReturning(500, "boom") });
    expect(result.ok).toBe(false);
    expect(result.failed).toBe(2);
  });

  it("skips UI steps and survives request errors", async () => {
    const scenario: QaScenario = {
      id: "mixed",
      name: "mixed",
      steps: [
        { action: "click", selector: "#settings" },
        { action: "request", method: "GET", path: "/health" },
      ],
    };
    const result = await runScenario(scenario, { fetchImpl: async () => { throw new Error("offline"); } });
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1].detail).toMatch(/offline/);
  });
});
