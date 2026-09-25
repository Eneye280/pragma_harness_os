import type { Gate, GateOutcome, PreGateContext } from "./types";

const VALID_DOMAINS = ["engine", "backend", "unity", "nexus", "gbl", "general"];
const VALID_TYPES = ["feature", "fix", "refactor", "qa", "docs"];
const VALID_EFFORTS = ["low", "medium", "high"];

export class SchemaGate implements Gate {
  readonly name = "schema-gate" as const;

  check(context: PreGateContext): GateOutcome {
    const problems: string[] = [];

    if (!context.workspaceHash) problems.push("missing workspaceHash");
    if (context.workspaceExists === false) problems.push("workspace path does not exist");
    if (!context.normalized) problems.push("empty message");

    if (context.intent) {
      if (!VALID_DOMAINS.includes(context.intent.domain)) problems.push(`invalid domain: ${context.intent.domain}`);
      if (!VALID_TYPES.includes(context.intent.type)) problems.push(`invalid type: ${context.intent.type}`);
      if (!VALID_EFFORTS.includes(context.intent.effort)) problems.push(`invalid effort: ${context.intent.effort}`);
      if (!Array.isArray(context.intent.needs)) problems.push("intent.needs must be an array");
    }

    if (problems.length > 0) {
      return { gate: this.name, verdict: "block", reason: "invalid pipeline input", detail: { problems } };
    }
    return { gate: this.name, verdict: "pass", reason: "intent and workspace valid" };
  }
}

export const schemaGate = new SchemaGate();
