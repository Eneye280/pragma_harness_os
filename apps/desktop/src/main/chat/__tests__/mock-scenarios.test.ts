import { describe, expect, it } from "vitest";
import { MOCK_SCENARIOS, matchScenario } from "../mock-scenarios";

describe("mock scenarios (deterministic fixtures)", () => {
  it("routes calculator prompts to the expected files", () => {
    expect(matchScenario("crea la logica de la calculadora")?.args.path).toBe("calculator.js");
    expect(matchScenario("crea el test de la calculadora")?.args.path).toBe("calculator.test.js");
    expect(matchScenario("crea el package.json")?.args.path).toBe("package.json");
    expect(matchScenario("crea una calculadora web")?.args.path).toBe("index.html");
  });

  it("returns null for unrelated prompts", () => {
    expect(matchScenario("revisa el estado del repo")).toBeNull();
  });

  it("every scenario targets a real path and has an intro", () => {
    for (const scenario of MOCK_SCENARIOS) {
      expect(typeof scenario.args.path).toBe("string");
      expect((scenario.args.path as string).length).toBeGreaterThan(0);
      expect(scenario.intro.length).toBeGreaterThan(0);
    }
  });
});
