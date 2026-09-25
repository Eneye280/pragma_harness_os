import { describe, it, expect } from "vitest";
import { PreAgentGates } from "../pre-gates";
import { SecretGate } from "../secret-gate";
import { BudgetGate } from "../budget-gate";
import { SchemaGate } from "../schema-gate";
import type { PreGateContext } from "../types";

function baseContext(overrides: Partial<PreGateContext> = {}): PreGateContext {
  return {
    message: "agrega endpoint /users",
    normalized: "agrega endpoint /users",
    sessionId: "sess-1",
    workspaceHash: "hash16",
    workspacePath: "/tmp/ws",
    intent: { domain: "backend", type: "feature", effort: "medium", needs: ["tdd"] },
    workspaceExists: true,
    ...overrides,
  };
}

describe("Pre-Agent Gates", () => {
  it("passes a clean message with every gate enabled", () => {
    const result = new PreAgentGates().run(baseContext());
    expect(result.verdict).toBe("pass");
    expect(result.outcomes.map((outcome) => outcome.gate)).toEqual(["secret-gate", "budget-gate", "schema-gate"]);
    expect(result.outcomes.every((outcome) => outcome.verdict === "pass")).toBe(true);
  });

  it("blocks a message containing sk- without ever calling the LLM", () => {
    const result = new PreAgentGates().run(baseContext({ message: "usa la key sk-abcdefgh12345678", normalized: "usa la key sk-abcdefgh12345678" }));
    expect(result.verdict).toBe("block");
    expect(result.blockedBy).toBe("secret-gate");
    expect(result.userResponse).toMatch(/secreto/i);
  });

  it("detects gateway-style secret patterns beyond sk-", () => {
    const gate = new SecretGate();
    expect(gate.check(baseContext({ message: "ghp_abcdefgh12345678", normalized: "ghp_abcdefgh12345678" })).verdict).toBe("block");
    expect(gate.check(baseContext({ message: "password=SuperSecret1", normalized: "password=SuperSecret1" })).verdict).toBe("block");
    expect(gate.check(baseContext()).verdict).toBe("pass");
  });

  it("blocks when the daily token budget is exhausted", () => {
    const result = new PreAgentGates().run(
      baseContext({ budget: { tokensUsed: 200000, tokensLimit: 200000, costUsedUsd: 0, costLimitUsd: 5 } })
    );
    expect(result.blockedBy).toBe("budget-gate");
    expect(result.userResponse).toMatch(/presupuesto/i);
  });

  it("blocks when the daily cost budget is exhausted", () => {
    const gate = new BudgetGate();
    const outcome = gate.check(baseContext({ budget: { tokensUsed: 100, tokensLimit: 200000, costUsedUsd: 5.5, costLimitUsd: 5 } }));
    expect(outcome.verdict).toBe("block");
    expect(outcome.reason).toMatch(/cost/i);
  });

  it("blocks an invalid intent domain or missing workspace", () => {
    const gate = new SchemaGate();
    expect(gate.check(baseContext({ intent: { domain: "planets", type: "feature", effort: "medium", needs: [] } })).verdict).toBe("block");
    expect(gate.check(baseContext({ workspaceExists: false })).verdict).toBe("block");
  });

  it("respects settings toggles and ordering", () => {
    const disabled = new PreAgentGates({ secret: false }).run(baseContext({ message: "key sk-abcdefgh12345678", normalized: "key sk-abcdefgh12345678" }));
    expect(disabled.verdict).toBe("pass");
    expect(disabled.outcomes[0].reason).toBe("disabled by settings");

    const allOff = new PreAgentGates({ enabled: false }).run(baseContext({ workspaceExists: false }));
    expect(allOff.verdict).toBe("pass");

    const secretBeatsSchema = new PreAgentGates().run(baseContext({ message: "sk-abcdefgh12345678", normalized: "sk-abcdefgh12345678", workspaceExists: false }));
    expect(secretBeatsSchema.blockedBy).toBe("secret-gate");
  });
});
