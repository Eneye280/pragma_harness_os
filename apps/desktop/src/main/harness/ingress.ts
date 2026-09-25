import { createHash, randomUUID } from "crypto";
import type { PipelineContext } from "./types";

export interface IngressResult {
  context: PipelineContext;
  eventId: string;
}

function hashWorkspace(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 12);
}

function detectCommands(message: string): string[] {
  const matches = message.matchAll(/(^|\s)\/([a-z0-9-]+)/g);
  return [...matches].map((m) => m[2]);
}

function detectMentions(message: string): string[] {
  const matches = message.matchAll(/@([a-z0-9_-]+)/g);
  return [...matches].map((m) => m[1]);
}

export class MessageIngress {
  intercept(
    rawMessage: string,
    opts: { sessionId?: string; workspacePath?: string } = {}
  ): IngressResult {
    const normalized = rawMessage.trim();
    if (!normalized) throw new Error("MessageIngress: empty message");

    const workspacePath = opts.workspacePath ?? process.cwd();
    const workspaceHash = hashWorkspace(workspacePath);
    const sessionId = opts.sessionId ?? `sess-${randomUUID().slice(0, 8)}`;

    const context: PipelineContext = {
      message: rawMessage,
      normalized,
      sessionId,
      workspaceHash,
      workspacePath,
      timestamp: Date.now(),
      commands: detectCommands(normalized),
      mentions: detectMentions(normalized),
    };

    return { context, eventId: randomUUID() };
  }

  createHarnessEvent(context: PipelineContext, eventId: string) {
    return {
      id: eventId,
      type: "harness:ingress" as const,
      payload: {
        message: context.normalized,
        rawLength: context.message.length,
        normalizedLength: context.normalized.length,
        commands: context.commands,
        mentions: context.mentions,
      },
      ts: context.timestamp,
      sessionId: context.sessionId,
      workspaceHash: context.workspaceHash,
      seq: 0,
    };
  }
}

export const ingress = new MessageIngress();
