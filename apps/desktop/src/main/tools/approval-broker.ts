import type { ToolApprovalDecision } from "./types";

interface PendingApproval {
  tool: string;
  resolve: (decision: ToolApprovalDecision) => void;
}

export class ToolApprovalBroker {
  private readonly pending = new Map<string, PendingApproval>();

  register(callId: string, tool: string): Promise<ToolApprovalDecision> {
    return new Promise<ToolApprovalDecision>((resolve) => {
      this.pending.set(callId, { tool, resolve });
    });
  }

  resolve(callId: string, decision: ToolApprovalDecision): { tool: string } | null {
    const entry = this.pending.get(callId);
    if (!entry) return null;
    this.pending.delete(callId);
    entry.resolve(decision);
    return { tool: entry.tool };
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
