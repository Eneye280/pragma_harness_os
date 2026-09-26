import { z } from "zod";

export const ToolNameSchema = z.enum(["fileRead", "fileEdit", "terminal", "mcp_call", "runTests", "runBuild", "runLint", "webFetch"]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export type PermissionMode = "allow" | "ask" | "deny";

export interface ToolCallInput {
  tool: ToolName;
  args: Record<string, unknown>;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
}

export interface ToolCallRecord {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  sessionId: string;
  ts: number;
}

export interface ToolObservation {
  callId: string;
  tool: ToolName;
  ok: boolean;
  output: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  blocked?: boolean;
  blockReason?: string;
  diffPreview?: string;
  ts: number;
}

export interface ConfirmHook {
  (pendingEdit: PendingEditPreview): Promise<boolean>;
}

export interface ToolApprovalRequest {
  callId: string;
  tool: ToolName;
  summary: string;
  sessionId: string;
  args: Record<string, unknown>;
}

export interface ToolApprovalDecision {
  approved: boolean;
  remember?: "allow" | "deny";
}

export interface ApproveHook {
  (request: ToolApprovalRequest): Promise<ToolApprovalDecision>;
}

export interface PendingEditPreview {
  callId: string;
  absolutePath: string;
  relativePath: string;
  beforeContent: string | null;
  afterContent: string;
  diffPreview: string;
  sessionId: string;
}

export const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{8,}/g,
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi,
  /password\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi,
  /ghp_[A-Za-z0-9]{8,}/g,
  /xox[bpas]-[A-Za-z0-9-]{8,}/g,
];

export function redactSecrets(rawText: string): string {
  let redacted = rawText;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}
