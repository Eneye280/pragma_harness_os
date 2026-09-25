import { terminalCommandRunner } from "./command-runner";
import { POST_GATE_PHASE_RUNNERS } from "./phases";
import {
  DEFAULT_POST_GATE_SETTINGS,
  POST_GATE_ORDER,
  type CommandRunner,
  type PhaseResult,
  type PostGatePhase,
  type PostGateSettings,
  type VerificationContext,
  type VerificationReport,
} from "./types";

export type FixAttempt = (report: VerificationReport) => Promise<Partial<VerificationContext>>;

export function buildFixPrompt(report: VerificationReport): string {
  const failedLines = report.results
    .filter((result) => result.verdict === "fail")
    .map((result) => {
      const detailText = result.detail ? ` — ${JSON.stringify(result.detail)}` : "";
      return `- ${result.phase}: ${result.reason}${detailText}`;
    });
  return [
    "El harness bloqueó la entrega: los gates post-agente fallaron. Corrige y vuelve a intentar.",
    "",
    ...failedLines,
  ].join("\n");
}

export class VerificationLoop {
  constructor(
    private readonly commandRunner: CommandRunner = terminalCommandRunner,
    private readonly settings: PostGateSettings = {}
  ) {}

  private isEnabled(phase: PostGatePhase): boolean {
    const resolved = { ...DEFAULT_POST_GATE_SETTINGS, ...this.settings };
    if (!resolved.enabled) return false;
    return resolved[phase];
  }

  async verify(context: VerificationContext): Promise<VerificationReport> {
    const results: PhaseResult[] = [];
    for (const phase of POST_GATE_ORDER) {
      if (!this.isEnabled(phase)) {
        results.push({ phase, verdict: "skipped", reason: "disabled by settings" });
        continue;
      }
      const runner = POST_GATE_PHASE_RUNNERS.find((candidate) => candidate.phase === phase);
      if (!runner) {
        results.push({ phase, verdict: "skipped", reason: "no phase runner registered" });
        continue;
      }
      results.push(await runner.run(context, this.commandRunner, this.settings));
    }
    const failedPhases = results.filter((result) => result.verdict === "fail").map((result) => result.phase);
    const report: VerificationReport = {
      verdict: failedPhases.length === 0 ? "pass" : "fail",
      results,
      failedPhases,
      attempts: 1,
    };
    if (report.verdict === "fail") report.fixPrompt = buildFixPrompt(report);
    return report;
  }

  async run(context: VerificationContext, attemptFix?: FixAttempt): Promise<VerificationReport> {
    const maxRetries = this.settings.maxRetries ?? DEFAULT_POST_GATE_SETTINGS.maxRetries;
    let currentContext = context;
    let lastReport = await this.verify(currentContext);
    lastReport.attempts = 1;

    for (let retry = 0; retry < maxRetries && lastReport.verdict === "fail"; retry++) {
      if (!attemptFix) break;
      const patch = await attemptFix(lastReport);
      currentContext = { ...currentContext, ...patch };
      lastReport = await this.verify(currentContext);
      lastReport.attempts = retry + 2;
    }

    return lastReport;
  }
}
