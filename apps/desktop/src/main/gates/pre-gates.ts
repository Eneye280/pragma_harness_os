import { budgetGate } from "./budget-gate";
import { schemaGate } from "./schema-gate";
import { secretGate } from "./secret-gate";
import {
  DEFAULT_PRE_GATE_SETTINGS,
  type Gate,
  type GateName,
  type GateOutcome,
  type PreGateContext,
  type PreGateResult,
  type PreGateSettings,
} from "./types";

const GATE_ORDER: Gate[] = [secretGate, budgetGate, schemaGate];

const BLOCK_MESSAGES: Record<GateName, string> = {
  "secret-gate": "Bloqueado por el harness: el mensaje parece contener un secreto (API key/token/password). Quítalo o usa una variable de entorno. No se llamó al modelo.",
  "budget-gate": "Bloqueado por el harness: presupuesto diario agotado. Ajusta el presupuesto en Settings o espera al reinicio de la ventana. No se llamó al modelo.",
  "schema-gate": "Bloqueado por el harness: contexto de pipeline inválido (intent o workspace). No se llamó al modelo.",
};

export class PreAgentGates {
  constructor(private readonly settings: PreGateSettings = {}) {}

  private isEnabled(gateName: GateName): boolean {
    const resolved = { ...DEFAULT_PRE_GATE_SETTINGS, ...this.settings };
    if (!resolved.enabled) return false;
    switch (gateName) {
      case "secret-gate":
        return resolved.secret;
      case "budget-gate":
        return resolved.budget;
      case "schema-gate":
        return resolved.schema;
    }
  }

  run(context: PreGateContext): PreGateResult {
    const outcomes: GateOutcome[] = [];
    for (const gate of GATE_ORDER) {
      if (!this.isEnabled(gate.name)) {
        outcomes.push({ gate: gate.name, verdict: "pass", reason: "disabled by settings" });
        continue;
      }
      const outcome = gate.check(context);
      outcomes.push(outcome);
      if (outcome.verdict === "block") {
        return {
          verdict: "block",
          blockedBy: outcome.gate,
          reason: outcome.reason,
          outcomes,
          userResponse: BLOCK_MESSAGES[outcome.gate],
        };
      }
    }
    return { verdict: "pass", outcomes };
  }
}

export const preAgentGates = new PreAgentGates();
