import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

export function resolveHarnessWorkspace(): string {
  const configured = process.env["HARNESS_WORKSPACE"];
  const workspacePath = configured ? resolve(configured) : join(tmpdir(), "pragma-harness", "workspace");
  if (!existsSync(workspacePath)) mkdirSync(workspacePath, { recursive: true });
  return workspacePath;
}
