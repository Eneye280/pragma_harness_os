export type PostGatePhase = "build" | "typecheck" | "lint" | "tests" | "security" | "visual";

export type PhaseVerdict = "pass" | "fail" | "skipped";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[], workspacePath: string): Promise<CommandResult>;
}

export interface PostGateSettings {
  enabled?: boolean;
  build?: boolean;
  typecheck?: boolean;
  lint?: boolean;
  tests?: boolean;
  security?: boolean;
  visual?: boolean;
  maxRetries?: number;
  coverageThreshold?: number;
  commands?: Partial<Record<PostGatePhase, string>>;
  visualCommand?: string;
}

export interface VerificationContext {
  workspacePath: string;
  domain?: string;
  diff?: string;
  isVisual?: boolean;
  filesChanged?: string[];
  coveragePct?: number;
}

export interface PhaseResult {
  phase: PostGatePhase;
  verdict: PhaseVerdict;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface VerificationReport {
  verdict: "pass" | "fail";
  results: PhaseResult[];
  failedPhases: PostGatePhase[];
  fixPrompt?: string;
  attempts: number;
}

export interface PostGatePhaseRunner {
  phase: PostGatePhase;
  run(context: VerificationContext, runner: CommandRunner, settings: PostGateSettings): Promise<PhaseResult>;
}

export const POST_GATE_ORDER: PostGatePhase[] = ["build", "typecheck", "lint", "tests", "security", "visual"];

export const DEFAULT_POST_GATE_SETTINGS: Required<Omit<PostGateSettings, "commands" | "visualCommand">> = {
  enabled: true,
  build: true,
  typecheck: true,
  lint: true,
  tests: true,
  security: true,
  visual: true,
  maxRetries: 3,
  coverageThreshold: 80,
};
