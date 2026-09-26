import { SECRET_PATTERNS } from "../tools/types";
import { blocksOnSecurity, reviewTextForRisks } from "../../shared/security-review";
import { shellTokens } from "./command-runner";
import type { CommandRunner, PhaseResult, PostGatePhase, PostGatePhaseRunner, PostGateSettings, VerificationContext } from "./types";

interface PhaseCommands {
  root: string;
  engine: string;
}

const PHASE_COMMANDS: Record<PostGatePhase, PhaseCommands> = {
  build: { root: "pnpm build", engine: "dotnet build" },
  typecheck: { root: "pnpm typecheck", engine: "dotnet build --no-restore" },
  lint: { root: "pnpm lint", engine: "dotnet format --verify-no-changes" },
  tests: { root: "pnpm test", engine: "dotnet test" },
  security: { root: "pnpm audit", engine: "dotnet list package --vulnerable" },
  visual: { root: "", engine: "" },
};

export function addedDiffLines(diff: string | undefined): string[] {
  if (!diff) return [];
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trimStart());
}

export function findConsoleLogs(diff: string | undefined): string[] {
  return addedDiffLines(diff).filter((line) => /\bconsole\.(log|debug)\s*\(/.test(line));
}

export function findSecretLines(diff: string | undefined): string[] {
  const hits: string[] = [];
  for (const line of addedDiffLines(diff)) {
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        hits.push(line.slice(0, 40));
        break;
      }
    }
  }
  return hits;
}

function resolveCommand(phase: PostGatePhase, context: VerificationContext, settings: PostGateSettings): string | null {
  if (phase === "visual") return settings.visualCommand ?? null;
  const override = settings.commands?.[phase];
  if (override) return override;
  const commands = PHASE_COMMANDS[phase];
  return context.domain === "engine" ? commands.engine : commands.root;
}

export function resolvePostGateCommand(phase: PostGatePhase, domain = "general"): string | null {
  if (phase === "visual") return null;
  return resolveCommand(phase, { workspacePath: "", domain } as VerificationContext, {});
}

class CommandPhase implements PostGatePhaseRunner {
  constructor(
    readonly phase: PostGatePhase,
    private readonly afterCommand?: (context: VerificationContext, result: PhaseResult) => PhaseResult
  ) {}

  async run(context: VerificationContext, runner: CommandRunner, settings: PostGateSettings): Promise<PhaseResult> {
    const rawCommand = resolveCommand(this.phase, context, settings);
    if (!rawCommand) {
      return { phase: this.phase, verdict: "skipped", reason: "no command configured for this phase" };
    }
    const { command, args } = shellTokens(rawCommand);
    const commandResult = await runner.run(command, args, context.workspacePath);
    const baseResult: PhaseResult = commandResult.exitCode === 0
      ? { phase: this.phase, verdict: "pass", reason: `${rawCommand} ok` }
      : { phase: this.phase, verdict: "fail", reason: `${rawCommand} exited ${commandResult.exitCode}`, detail: { stderr: commandResult.stderr.slice(0, 400) } };
    return this.afterCommand ? this.afterCommand(context, baseResult) : baseResult;
  }
}

class TestsPhase implements PostGatePhaseRunner {
  readonly phase = "tests" as const;

  async run(context: VerificationContext, runner: CommandRunner, settings: PostGateSettings): Promise<PhaseResult> {
    const rawCommand = resolveCommand("tests", context, settings);
    if (!rawCommand) return { phase: this.phase, verdict: "skipped", reason: "no test command configured" };
    const { command, args } = shellTokens(rawCommand);
    const commandResult = await runner.run(command, args, context.workspacePath);
    if (commandResult.exitCode !== 0) {
      return { phase: this.phase, verdict: "fail", reason: `${rawCommand} exited ${commandResult.exitCode}`, detail: { stderr: commandResult.stderr.slice(0, 400) } };
    }
    const threshold = settings.coverageThreshold ?? 80;
    if (typeof context.coveragePct === "number" && context.coveragePct < threshold) {
      return { phase: this.phase, verdict: "fail", reason: `coverage ${context.coveragePct}% below threshold ${threshold}%`, detail: { coveragePct: context.coveragePct, threshold } };
    }
    return { phase: this.phase, verdict: "pass", reason: `tests ok${typeof context.coveragePct === "number" ? ` (coverage ${context.coveragePct}%)` : ""}` };
  }
}

class SecurityPhase implements PostGatePhaseRunner {
  readonly phase = "security" as const;

  async run(context: VerificationContext, runner: CommandRunner, settings: PostGateSettings): Promise<PhaseResult> {
    const secretLines = findSecretLines(context.diff);
    if (secretLines.length > 0) {
      return { phase: this.phase, verdict: "fail", reason: "diff contains what looks like a secret", detail: { samples: secretLines.length, paths: context.filesChanged ?? [] } };
    }
    const risky = reviewTextForRisks(context.diff ?? "", true).filter(blocksOnSecurity);
    if (risky.length > 0) {
      return { phase: this.phase, verdict: "fail", reason: `patrón inseguro en el diff: ${risky[0].rule} (${risky[0].advice})`, detail: { findings: risky.length } };
    }
    const rawCommand = resolveCommand("security", context, settings);
    if (!rawCommand) return { phase: this.phase, verdict: "pass", reason: "secret scan clean" };
    const { command, args } = shellTokens(rawCommand);
    const commandResult = await runner.run(command, args, context.workspacePath);
    if (commandResult.exitCode !== 0) {
      return { phase: this.phase, verdict: "fail", reason: `security scanner exited ${commandResult.exitCode}`, detail: { stderr: commandResult.stderr.slice(0, 400) } };
    }
    return { phase: this.phase, verdict: "pass", reason: "secret scan clean" };
  }
}

class VisualPhase implements PostGatePhaseRunner {
  readonly phase = "visual" as const;

  async run(context: VerificationContext, runner: CommandRunner, settings: PostGateSettings): Promise<PhaseResult> {
    if (!context.isVisual) return { phase: this.phase, verdict: "skipped", reason: "not a visual task" };
    const rawCommand = settings.visualCommand;
    if (!rawCommand) return { phase: this.phase, verdict: "skipped", reason: "visual task but no visual command configured" };
    const { command, args } = shellTokens(rawCommand);
    const commandResult = await runner.run(command, args, context.workspacePath);
    return commandResult.exitCode === 0
      ? { phase: this.phase, verdict: "pass", reason: `${rawCommand} ok` }
      : { phase: this.phase, verdict: "fail", reason: `visual capture exited ${commandResult.exitCode}`, detail: { stderr: commandResult.stderr.slice(0, 400) } };
  }
}

export const POST_GATE_PHASE_RUNNERS: PostGatePhaseRunner[] = [
  new CommandPhase("build"),
  new CommandPhase("typecheck"),
  new CommandPhase("lint", (context, baseResult) => {
    const consoleLogs = findConsoleLogs(context.diff);
    if (consoleLogs.length === 0) return baseResult;
    if (baseResult.verdict === "fail") return { ...baseResult, detail: { ...baseResult.detail, consoleLogs: consoleLogs.length } };
    return { phase: "lint", verdict: "fail", reason: `no-console-log: ${consoleLogs.length} added console.log line(s)`, detail: { consoleLogs } };
  }),
  new TestsPhase(),
  new SecurityPhase(),
  new VisualPhase(),
];
