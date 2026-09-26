import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createPostmortem, proposeInstincts, summarizePostmortems, type RunPostmortem } from "../../shared/learning";

export class LearningStore {
  constructor(private readonly filePath: string) {}

  private load(): RunPostmortem[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, "utf8"));
      return Array.isArray(parsed) ? (parsed as RunPostmortem[]) : [];
    } catch {
      return [];
    }
  }

  private persist(list: RunPostmortem[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(list.slice(-200), null, 2), "utf8");
  }

  record(entry: Omit<RunPostmortem, "ts"> & { ts?: number }): RunPostmortem {
    const postmortem = createPostmortem(entry);
    this.persist([...this.load(), postmortem]);
    return postmortem;
  }

  list(): RunPostmortem[] {
    return this.load();
  }

  snapshot(): { postmortems: RunPostmortem[]; summary: ReturnType<typeof summarizePostmortems>; proposals: ReturnType<typeof proposeInstincts> } {
    const postmortems = this.load();
    return { postmortems, summary: summarizePostmortems(postmortems), proposals: proposeInstincts(postmortems) };
  }
}

export function resolveLearningPath(workspacePath: string): string {
  return join(workspacePath, ".pragma-harness", "learning.json");
}
