import type { ChatStreamEvent } from "../../shared/chat-events";
import type { PlanDecision, PlanIntent, PlanProposal } from "../../shared/plan";
import { recompilePlan } from "./plan-builder";

export interface PlanGate {
  propose(plan: PlanProposal, emit: (event: ChatStreamEvent) => void): Promise<PlanDecision>;
}

interface PendingPlan {
  resolve: (decision: PlanDecision) => void;
  emit: (event: ChatStreamEvent) => void;
  intent: PlanIntent;
}

export class PlanController implements PlanGate {
  private readonly pending = new Map<string, PendingPlan>();

  propose(plan: PlanProposal, emit: (event: ChatStreamEvent) => void): Promise<PlanDecision> {
    emit({ kind: "plan-proposed", sessionId: plan.sessionId, plan });
    return new Promise<PlanDecision>((resolve) => {
      this.pending.set(plan.sessionId, { resolve, emit, intent: plan.intent });
    });
  }

  decide(sessionId: string, decision: PlanDecision): boolean {
    const entry = this.pending.get(sessionId);
    if (!entry) return false;
    this.pending.delete(sessionId);
    entry.emit({ kind: "plan-resolved", sessionId, action: decision.action });
    entry.resolve(decision);
    return true;
  }

  revise(sessionId: string, markdown: string): boolean {
    const entry = this.pending.get(sessionId);
    if (!entry) return false;
    const plan = recompilePlan(markdown, sessionId, entry.intent);
    entry.emit({ kind: "plan-proposed", sessionId, plan });
    return true;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
