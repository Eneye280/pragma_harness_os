import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { resolveMetricsPath } from "../cost/cost-tracker";
import type { UsageEntry } from "../../shared/usage";

export function resolveUsagePath(): string {
  const configured = process.env["HARNESS_USAGE_PATH"];
  if (configured) return configured;
  return join(dirname(resolveMetricsPath()), "usage.jsonl");
}

export class UsageStore {
  constructor(private readonly filePath: string = resolveUsagePath()) {}

  record(entry: UsageEntry): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // usage logging must never break a run
    }
  }

  all(): UsageEntry[] {
    if (!existsSync(this.filePath)) return [];
    try {
      return readFileSync(this.filePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as UsageEntry)
        .filter((entry) => typeof entry.ts === "number");
    } catch {
      return [];
    }
  }
}
