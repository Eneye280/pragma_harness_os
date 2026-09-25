import { describe, it, expect } from "vitest";
import { VerificationLoop } from "../loop";
import { findConsoleLogs, findSecretLines, addedDiffLines } from "../phases";
import type { CommandRunner, VerificationContext } from "../types";

class FakeCommandRunner implements CommandRunner {
  calls: string[] = [];

  constructor(private readonly resolver: (command: string, args: string[]) => number = () => 0) {}

  async run(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.calls.push([command, ...args].join(" "));
    const exitCode = this.resolver(command, args);
    return { exitCode, stdout: "", stderr: exitCode === 0 ? "" : `${command} failed` };
  }
}

function baseContext(overrides: Partial<VerificationContext> = {}): VerificationContext {
  return { workspacePath: "/tmp/ws", domain: "backend", diff: "+ const ok = 1", coveragePct: 90, ...overrides };
}

describe("Post-Agent Verification Loop", () => {
  it("passes all six phases when commands succeed and coverage is met", async () => {
    const runner = new FakeCommandRunner();
    const report = await new VerificationLoop(runner).verify(baseContext());
    expect(report.verdict).toBe("pass");
    expect(report.results).toHaveLength(6);
    expect(report.failedPhases).toEqual([]);
    expect(runner.calls[0]).toContain("pnpm build");
    expect(runner.calls[1]).toContain("pnpm typecheck");
    expect(runner.calls[2]).toContain("pnpm lint");
    expect(runner.calls[3]).toContain("pnpm test");
  });

  it("fails the build phase when the build command exits non-zero", async () => {
    const runner = new FakeCommandRunner((command) => (command === "pnpm" ? 1 : 0));
    const report = await new VerificationLoop(runner).verify(baseContext());
    expect(report.verdict).toBe("fail");
    expect(report.failedPhases).toContain("build");
    expect(report.fixPrompt).toMatch(/build/);
  });

  it("fails lint on added console.log even when the lint command passes", async () => {
    const runner = new FakeCommandRunner();
    const loop = new VerificationLoop(runner);
    const report = await loop.verify(baseContext({ diff: "+ function run() {\n+   console.log('debug')\n+ }" }));
    expect(report.verdict).toBe("fail");
    expect(report.failedPhases).toContain("lint");
    expect(report.fixPrompt).toMatch(/console-log/i);
  });

  it("re-injects the fix prompt and passes after the agent corrects the console.log", async () => {
    const runner = new FakeCommandRunner();
    const loop = new VerificationLoop(runner, { maxRetries: 3 });
    let attemptsSeen = 0;
    const report = await loop.run(
      baseContext({ diff: "+ console.log('debug')" }),
      async (failureReport) => {
        attemptsSeen += 1;
        expect(failureReport.fixPrompt).toBeTruthy();
        return { diff: "+ const clean = true" };
      }
    );
    expect(attemptsSeen).toBe(1);
    expect(report.verdict).toBe("pass");
    expect(report.attempts).toBe(2);
  });

  it("fails security when the diff leaks a secret", async () => {
    const runner = new FakeCommandRunner();
    const report = await new VerificationLoop(runner).verify(baseContext({ diff: "+ const key = 'sk-abcdefgh12345678'" }));
    expect(report.failedPhases).toContain("security");
  });

  it("fails tests when coverage is below the threshold", async () => {
    const runner = new FakeCommandRunner();
    const report = await new VerificationLoop(runner, { coverageThreshold: 80 }).verify(baseContext({ coveragePct: 61 }));
    expect(report.failedPhases).toContain("tests");
    expect(report.results.find((result) => result.phase === "tests")?.reason).toMatch(/coverage/i);
  });

  it("uses engine commands for the engine domain", async () => {
    const runner = new FakeCommandRunner();
    await new VerificationLoop(runner).verify(baseContext({ domain: "engine" }));
    expect(runner.calls[0]).toContain("dotnet build");
    expect(runner.calls[3]).toContain("dotnet test");
  });

  it("runs the visual phase only for visual tasks", async () => {
    const runner = new FakeCommandRunner();
    const loop = new VerificationLoop(runner, { visualCommand: "capture_ppm" });
    const nonVisual = await loop.verify(baseContext({ isVisual: false }));
    expect(nonVisual.results.find((result) => result.phase === "visual")?.verdict).toBe("skipped");
    const visual = await loop.verify(baseContext({ isVisual: true }));
    expect(visual.results.find((result) => result.phase === "visual")?.verdict).toBe("pass");
    expect(runner.calls).toContain("capture_ppm");
  });

  it("respects per-phase toggles", async () => {
    const runner = new FakeCommandRunner();
    const report = await new VerificationLoop(runner, { tests: false, security: false }).verify(baseContext());
    expect(report.results.find((result) => result.phase === "tests")?.verdict).toBe("skipped");
    expect(report.results.find((result) => result.phase === "security")?.verdict).toBe("skipped");
    expect(runner.calls.some((call) => call.includes("pnpm test"))).toBe(false);
  });

  it("stops after max retries when the agent cannot fix the failure", async () => {
    const runner = new FakeCommandRunner((command) => (command === "pnpm" ? 1 : 0));
    const report = await new VerificationLoop(runner, { maxRetries: 2 }).run(baseContext(), async () => ({}));
    expect(report.verdict).toBe("fail");
    expect(report.attempts).toBe(3);
  });

  it("scans only added lines for console.log and secrets", () => {
    const diff = "- console.log('removed')\n+ console.log('added')\n+ const safe = 1";
    expect(addedDiffLines(diff)).toEqual(["console.log('added')", "const safe = 1"]);
    expect(findConsoleLogs(diff)).toEqual(["console.log('added')"]);
    expect(findSecretLines("+ const t = 'ghp_abcdefgh12345678'")).toHaveLength(1);
  });
});
