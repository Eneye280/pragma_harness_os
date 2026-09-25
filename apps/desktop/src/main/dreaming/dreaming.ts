import type { DreamCandidate, DreamCandidateKind } from "../../shared/dream";

export interface DreamEvent {
  type: string;
  payload: unknown;
  sessionId: string;
  ts: number;
}

export interface CorrectionPayload {
  kind: "correction";
  trigger: string;
  content: string;
  domain?: string;
}

export interface ObservationPayload {
  ok?: boolean;
  tool?: string;
  output?: string;
  stderr?: string;
}

const ERROR_THRESHOLD = 2;
const WORKFLOW_THRESHOLD = 2;

function isCorrectionEvent(event: DreamEvent): event is DreamEvent & { payload: CorrectionPayload } {
  if (event.type !== "harness:memory-write") return false;
  const payload = event.payload as Partial<CorrectionPayload> | null;
  return Boolean(payload && payload.kind === "correction" && typeof payload.trigger === "string");
}

function isFailedObservation(event: DreamEvent): boolean {
  if (event.type !== "agent:observation") return false;
  const payload = event.payload as ObservationPayload | null;
  return Boolean(payload && payload.ok === false);
}

export function detectPatterns(events: DreamEvent[]): DreamCandidate[] {
  const candidates: DreamCandidate[] = [];

  const corrections = new Map<string, { content: string; domain: string; count: number; evidence: string[] }>();
  for (const event of events) {
    if (!isCorrectionEvent(event)) continue;
    const key = event.payload.trigger;
    const entry = corrections.get(key) ?? { content: event.payload.content, domain: event.payload.domain ?? "general", count: 0, evidence: [] };
    entry.count += 1;
    entry.content = event.payload.content;
    entry.evidence.push(event.payload.content.slice(0, 120));
    corrections.set(key, entry);
  }
  for (const [trigger, entry] of corrections) {
    if (entry.count < ERROR_THRESHOLD) continue;
    candidates.push({
      kind: "correction",
      trigger: `correction:${trigger}`,
      content: entry.content,
      domain: entry.domain,
      count: entry.count,
      evidence: entry.evidence.slice(-5),
    });
  }

  const failures = new Map<string, { count: number; evidence: string[] }>();
  for (const event of events) {
    if (!isFailedObservation(event)) continue;
    const payload = event.payload as ObservationPayload;
    const key = payload.tool ?? "unknown";
    const entry = failures.get(key) ?? { count: 0, evidence: [] };
    entry.count += 1;
    entry.evidence.push((payload.output || payload.stderr || key).slice(0, 120));
    failures.set(key, entry);
  }
  for (const [tool, entry] of failures) {
    if (entry.count < ERROR_THRESHOLD) continue;
    candidates.push({
      kind: "error",
      trigger: `error:${tool}`,
      content: `El tool ${tool} falló ${entry.count} veces: verificar antes de reintentar`,
      domain: "general",
      count: entry.count,
      evidence: entry.evidence.slice(-5),
    });
  }

  const sessionToolSequences = new Map<string, string[]>();
  for (const event of events) {
    if (event.type !== "agent:tool-call") continue;
    const payload = event.payload as { tool?: string } | null;
    if (!payload?.tool) continue;
    const sequence = sessionToolSequences.get(event.sessionId) ?? [];
    sequence.push(payload.tool);
    sessionToolSequences.set(event.sessionId, sequence);
  }
  const signatureCounts = new Map<string, { count: number; sessions: string[] }>();
  for (const [sessionId, sequence] of sessionToolSequences) {
    const signature = sequence.join(">");
    const entry = signatureCounts.get(signature) ?? { count: 0, sessions: [] };
    entry.count += 1;
    entry.sessions.push(sessionId);
    signatureCounts.set(signature, entry);
  }
  for (const [signature, entry] of signatureCounts) {
    if (entry.count < WORKFLOW_THRESHOLD) continue;
    candidates.push({
      kind: "workflow",
      trigger: `workflow:${signature}`,
      content: `Workflow repetido (${signature}) en ${entry.count} sesiones: candidato a skill`,
      domain: "general",
      count: entry.count,
      evidence: entry.sessions.slice(-5),
    });
  }

  return candidates;
}

export interface ConsolidationResult {
  kind: DreamCandidateKind;
  trigger: string;
  content: string;
  confidence: number;
}

export interface DreamingDeps {
  addInstinct: (
    workspacePath: string,
    data: { trigger: string; content: string; domain?: string; evidence?: string }
  ) => { trigger: string; content: string; confidence: number };
  analyze?: (candidate: DreamCandidate) => Promise<string>;
}

export async function consolidate(
  events: DreamEvent[],
  workspacePath: string,
  deps: DreamingDeps
): Promise<ConsolidationResult[]> {
  const candidates = detectPatterns(events);
  const results: ConsolidationResult[] = [];

  for (const candidate of candidates) {
    let content = candidate.content;
    if (deps.analyze) {
      try {
        const analyzed = await deps.analyze(candidate);
        if (analyzed.trim()) content = analyzed.trim();
      } catch {
        content = candidate.content;
      }
    }
    const instinct = deps.addInstinct(workspacePath, {
      trigger: candidate.trigger,
      content,
      domain: candidate.domain,
      evidence: candidate.evidence.join(" | "),
    });
    results.push({ kind: candidate.kind, trigger: instinct.trigger, content: instinct.content, confidence: instinct.confidence });
  }

  return results;
}
