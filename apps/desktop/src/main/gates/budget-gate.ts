import type { Gate, GateOutcome, PreGateContext } from "./types";

export const DEFAULT_TOKEN_BUDGET = 200000;
export const DEFAULT_COST_BUDGET_USD = 5;

export class BudgetGate implements Gate {
  readonly name = "budget-gate" as const;

  check(context: PreGateContext): GateOutcome {
    const budget = context.budget;
    if (!budget) {
      return { gate: this.name, verdict: "pass", reason: "no budget window configured" };
    }

    const tokensLimit = budget.tokensLimit > 0 ? budget.tokensLimit : DEFAULT_TOKEN_BUDGET;
    const costLimit = budget.costLimitUsd > 0 ? budget.costLimitUsd : DEFAULT_COST_BUDGET_USD;

    if (budget.tokensUsed >= tokensLimit) {
      return {
        gate: this.name,
        verdict: "block",
        reason: "daily token budget exhausted",
        detail: { tokensUsed: budget.tokensUsed, tokensLimit },
      };
    }

    if (budget.costUsedUsd >= costLimit) {
      return {
        gate: this.name,
        verdict: "block",
        reason: "daily cost budget exhausted",
        detail: { costUsedUsd: budget.costUsedUsd, costLimitUsd: costLimit },
      };
    }

    return {
      gate: this.name,
      verdict: "pass",
      reason: "within daily budget",
      detail: { tokensUsed: budget.tokensUsed, tokensLimit, costUsedUsd: budget.costUsedUsd, costLimitUsd: costLimit },
    };
  }
}

export const budgetGate = new BudgetGate();
