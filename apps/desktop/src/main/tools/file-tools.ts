import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "path";
import { randomUUID } from "crypto";
import type { PendingEditPreview } from "./types";

export interface FileEditRequest {
  relativePath: string;
  content: string;
  workspacePath: string;
  sessionId: string;
}

export interface FileEditResult {
  callId: string;
  absolutePath: string;
  relativePath: string;
  created: boolean;
  diffPreview: string;
  beforeContent: string | null;
  afterContent: string;
}

export interface UndoEntry {
  absolutePath: string;
  beforeContent: string | null;
  existedBefore: boolean;
}

function assertInsideWorkspace(workspacePath: string, absolutePath: string): void {
  const normalizedWorkspace = resolve(workspacePath) + sep;
  const normalizedTarget = resolve(absolutePath);
  if (normalizedTarget !== resolve(workspacePath) && !normalizedTarget.startsWith(normalizedWorkspace)) {
    throw new Error(`fileEdit: path escapes workspace: ${absolutePath}`);
  }
}

export function resolveInsideWorkspace(workspacePath: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    const absoluteTarget = resolve(relativePath);
    assertInsideWorkspace(workspacePath, absoluteTarget);
    return absoluteTarget;
  }
  const normalizedRelative = relativePath.replace(/\\/g, "/");
  const absoluteTarget = resolve(join(resolve(workspacePath), normalizedRelative));
  assertInsideWorkspace(workspacePath, absoluteTarget);
  return absoluteTarget;
}

export function toRelativePath(workspacePath: string, absolutePath: string): string {
  return relative(resolve(workspacePath), resolve(absolutePath)).replace(/\\/g, "/");
}

export function buildLineDiff(beforeContent: string | null, afterContent: string): string {
  const beforeLines = beforeContent === null ? [] : beforeContent.split("\n");
  const afterLines = afterContent.split("\n");
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const diffLines: string[] = [];
  for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
    const beforeLine = beforeLines[lineIndex];
    const afterLine = afterLines[lineIndex];
    if (beforeLine === afterLine) {
      if (afterLine !== undefined) diffLines.push(`  ${afterLine}`);
    } else {
      if (beforeLine !== undefined) diffLines.push(`- ${beforeLine}`);
      if (afterLine !== undefined) diffLines.push(`+ ${afterLine}`);
    }
  }
  return diffLines.join("\n");
}

export function readWorkspaceFile(workspacePath: string, relativePath: string): { absolutePath: string; content: string } {
  const absolutePath = resolveInsideWorkspace(workspacePath, relativePath);
  if (!existsSync(absolutePath)) throw new Error(`fileRead: not found: ${relativePath}`);
  const content = readFileSync(absolutePath, "utf8");
  return { absolutePath, content };
}

export class FileEditHistory {
  private readonly undoStack: UndoEntry[] = [];

  stage(absolutePath: string): void {
    const existedBefore = existsSync(absolutePath);
    const beforeContent = existedBefore ? readFileSync(absolutePath, "utf8") : null;
    this.undoStack.push({ absolutePath, beforeContent, existedBefore });
  }

  undoLast(): UndoEntry | null {
    const lastEntry = this.undoStack.pop();
    if (!lastEntry) return null;
    if (!lastEntry.existedBefore || lastEntry.beforeContent === null) {
      if (existsSync(lastEntry.absolutePath)) {
        writeFileSync(lastEntry.absolutePath, "", "utf8");
      }
    } else {
      mkdirSync(dirname(lastEntry.absolutePath), { recursive: true });
      writeFileSync(lastEntry.absolutePath, lastEntry.beforeContent, "utf8");
    }
    return lastEntry;
  }

  pendingCount(): number {
    return this.undoStack.length;
  }

  buildPreview(request: FileEditRequest): PendingEditPreview & FileEditResult {
    const absolutePath = resolveInsideWorkspace(request.workspacePath, request.relativePath);
    const existedBefore = existsSync(absolutePath);
    const beforeContent = existedBefore ? readFileSync(absolutePath, "utf8") : null;
    const diffPreview = buildLineDiff(beforeContent, request.content);
    const callId = randomUUID();
    const relativePath = toRelativePath(request.workspacePath, absolutePath);
    return {
      callId,
      absolutePath,
      relativePath,
      created: !existedBefore,
      diffPreview,
      beforeContent,
      afterContent: request.content,
      sessionId: request.sessionId,
    };
  }

  applyPreview(preview: PendingEditPreview & FileEditResult): FileEditResult {
    this.stage(preview.absolutePath);
    mkdirSync(dirname(preview.absolutePath), { recursive: true });
    writeFileSync(preview.absolutePath, preview.afterContent, "utf8");
    return {
      callId: preview.callId,
      absolutePath: preview.absolutePath,
      relativePath: preview.relativePath,
      created: preview.beforeContent === null,
      diffPreview: preview.diffPreview,
      beforeContent: preview.beforeContent,
      afterContent: preview.afterContent,
    };
  }
}
