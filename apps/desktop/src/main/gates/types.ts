import type { IntentLike } from "../harness/types";

export type GateName = "secret-gate" | "budget-gate" | "schema-gate";

export type GateVerdict = "pass" | "block";

export interface PreGateSettings {
  enabled?: boolean;
  secret?: boolean;
  budget?: boolean;
  schema?: boolean;
}

export interface BudgetWindow {
  tokensUsed: number;
  tokensLimit: number;
  costUsedUsd: number;
  costLimitUsd: number;
}

export interface PreGateContext {
  message: string;
  normalized: string;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
  intent?: IntentLike;
  workspaceExists?: boolean;
  budget?: BudgetWindow;
}

export interface GateOutcome {
  gate: GateName;
  verdict: GateVerdict;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface PreGateResult {
  verdict: GateVerdict;
  blockedBy?: GateName;
  reason?: string;
  outcomes: GateOutcome[];
  userResponse?: string;
}

export interface Gate {
  name: GateName;
  check(context: PreGateContext): GateOutcome;
}

export const DEFAULT_PRE_GATE_SETTINGS: Required<PreGateSettings> = {
  enabled: true,
  secret: true,
  budget: true,
  schema: true,
};
