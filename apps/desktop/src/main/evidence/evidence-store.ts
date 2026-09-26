import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export const EVIDENCE_DIRECTORY = join(".pragma-harness", "evidence");
export const EVIDENCE_IGNORE_ENTRY = ".pragma-harness/evidence/";

export function evidenceDirectory(workspacePath: string): string {
  return join(workspacePath, EVIDENCE_DIRECTORY);
}

export function evidencePath(workspacePath: string, task: string, ts = Date.now()): string {
  const safeTask = task.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60) || "task";
  return join(evidenceDirectory(workspacePath), safeTask, `${ts}.png`);
}

export function saveEvidence(workspacePath: string, task: string, png: Buffer, ts = Date.now()): { path: string; bytes: number } {
  const target = evidencePath(workspacePath, task, ts);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
  return { path: target, bytes: png.length };
}

export function ensureEvidenceIgnored(workspacePath: string): boolean {
  const gitignorePath = join(workspacePath, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  if (existing.split(/\r?\n/).some((line) => line.trim() === EVIDENCE_IGNORE_ENTRY)) return false;
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(gitignorePath, `${existing}${prefix}\n# Visual evidence (local only)\n${EVIDENCE_IGNORE_ENTRY}\n`, "utf8");
  return true;
}
