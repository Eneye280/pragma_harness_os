import { describe, expect, it } from "vitest";
import { runVerifyTool } from "../verify-tools";

describe("agent verification tools", () => {
  it("maps runTests/runBuild/runLint to the post-gate commands", async () => {
    const seen: string[] = [];
    const exec = async (command: string, args: string[]) => {
      seen.push([command, ...args].join(" "));
      return { exitCode: 0, stdout: "all good", stderr: "", durationMs: 5 };
    };
    const tests = await runVerifyTool("runTests", "/tmp", { exec });
    const build = await runVerifyTool("runBuild", "/tmp", { exec });
    const lint = await runVerifyTool("runLint", "/tmp", { exec });
    expect(tests.ok).toBe(true);
    expect(tests.command).toBe("pnpm test");
    expect(build.command).toBe("pnpm build");
    expect(lint.command).toBe("pnpm lint");
    expect(seen).toEqual(["pnpm test", "pnpm build", "pnpm lint"]);
  });

  it("returns a red result when the command fails", async () => {
    const exec = async () => ({ exitCode: 1, stdout: "", stderr: "3 tests failed", durationMs: 10 });
    const result = await runVerifyTool("runTests", "/tmp", { exec });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("3 tests failed");
  });

  it("truncates and redacts output", async () => {
    const exec = async () => ({ exitCode: 0, stdout: "x".repeat(20000) + " sk-abcdefgh12345678", stderr: "", durationMs: 1 });
    const result = await runVerifyTool("runBuild", "/tmp", { exec });
    expect(result.output.length).toBeLessThan(9000);
    expect(result.output).not.toContain("sk-abcdefgh12345678");
  });
});
