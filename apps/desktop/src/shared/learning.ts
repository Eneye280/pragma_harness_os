export type RunOutcome = "done" | "failed" | "blocked";

export interface RunPostmortem {
  sessionId: string;
  goal: string;
  outcome: RunOutcome;
  failures: string[];
  fixes: string[];
  lessons: string[];
  ts: number;
}

export interface InstinctProposal {
  trigger: string;
  content: string;
  evidence: string[];
  confidence: number;
  autoApply: boolean;
}

export function createPostmortem(input: Omit<RunPostmortem, "ts"> & { ts?: number }): RunPostmortem {
  return {
    sessionId: input.sessionId,
    goal: input.goal.slice(0, 200),
    outcome: input.outcome,
    failures: [...new Set(input.failures.map((entry) => entry.trim()).filter(Boolean))],
    fixes: [...new Set(input.fixes.map((entry) => entry.trim()).filter(Boolean))],
    lessons: [...new Set(input.lessons.map((entry) => entry.trim()).filter(Boolean))],
    ts: input.ts ?? Date.now(),
  };
}

export interface LearningSummary {
  total: number;
  failed: number;
  blocked: number;
  done: number;
  topFailures: Array<{ failure: string; count: number }>;
  topLessons: Array<{ lesson: string; count: number }>;
}

export function summarizePostmortems(postmortems: RunPostmortem[]): LearningSummary {
  const failures = new Map<string, number>();
  const lessons = new Map<string, number>();
  for (const postmortem of postmortems) {
    for (const failure of postmortem.failures) failures.set(failure, (failures.get(failure) ?? 0) + 1);
    for (const lesson of postmortem.lessons) lessons.set(lesson, (lessons.get(lesson) ?? 0) + 1);
  }
  const topFailures = [...failures.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([failure, count]) => ({ failure, count }));
  const topLessons = [...lessons.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([lesson, count]) => ({ lesson, count }));
  return {
    total: postmortems.length,
    failed: postmortems.filter((postmortem) => postmortem.outcome === "failed").length,
    blocked: postmortems.filter((postmortem) => postmortem.outcome === "blocked").length,
    done: postmortems.filter((postmortem) => postmortem.outcome === "done").length,
    topFailures,
    topLessons,
  };
}

export const REPEAT_THRESHOLD = 2;

export function proposeInstincts(postmortems: RunPostmortem[], threshold = REPEAT_THRESHOLD): InstinctProposal[] {
  const grouped = new Map<string, RunPostmortem[]>();
  for (const postmortem of postmortems) {
    for (const failure of postmortem.failures) {
      const list = grouped.get(failure) ?? [];
      list.push(postmortem);
      grouped.set(failure, list);
    }
  }
  const proposals: InstinctProposal[] = [];
  for (const [failure, runs] of grouped) {
    if (runs.length < threshold) continue;
    const fixes = [...new Set(runs.flatMap((run) => run.fixes))];
    proposals.push({
      trigger: failure,
      content: fixes.length > 0 ? `Cuando ocurra "${failure}", aplicar: ${fixes[0]}` : `Evitar repetir: ${failure}`,
      evidence: runs.map((run) => `${run.goal} (${run.outcome})`).slice(0, 5),
      confidence: Math.min(0.95, 0.5 + runs.length * 0.1),
      autoApply: false,
    });
  }
  return proposals.sort((left, right) => right.confidence - left.confidence);
}

export function canAutoApply(): boolean {
  return false;
}
