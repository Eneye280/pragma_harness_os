import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { simpleGit } from "simple-git";
import { WorkspaceManager } from "../../workspace/manager";
import { ToolRunner } from "../../tools/runner";
import { VerificationLoop } from "../../postgates/loop";
import { classify } from "../classifier";
import { runDeterministicPipeline, replayDeterministic, type PipelineStageDeps } from "../session";
import { buildHarnessContext } from "../../context/harness-context";
import { benchmarkHarnessFirst } from "../benchmark";
import { SeedPluginRunner } from "../../plugins/registry";
import { SEED_PLUGINS } from "../../plugins/registry";
import type { CommandRunner } from "../../postgates/types";

const FIXTURES: Array<{ repoRoot: string; worktreeRoot: string }> = [];

async function makeRepo() {
  const suffix = randomUUID().slice(0, 8);
  const repoRoot = join(tmpdir(), `phs29-repo-${suffix}`);
  const worktreeRoot = join(tmpdir(), `phs29-wt-${suffix}`);
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });
  const git = simpleGit(repoRoot);
  await git.raw(["init", "-b", "development"]);
  await git.addConfig("user.email", "harness@test.local");
  await git.addConfig("user.name", "Harness Test");
  writeFileSync(join(repoRoot, "README.md"), "# harness\n", "utf8");
  await git.add(["README.md"]);
  await git.commit(["seed"]);
  FIXTURES.push({ repoRoot, worktreeRoot });
  return { repoRoot, worktreeRoot };
}

afterEach(() => {
  while (FIXTURES.length > 0) {
    const fixture = FIXTURES.pop();
    if (fixture && existsSync(fixture.repoRoot)) rmSync(fixture.repoRoot, { recursive: true, force: true });
    if (fixture && existsSync(fixture.worktreeRoot)) rmSync(fixture.worktreeRoot, { recursive: true, force: true });
  }
});

const passingCommandRunner: CommandRunner = { run: async () => ({ exitCode: 0, stdout: "", stderr: "" }) };

function makePipelineDeps(): PipelineStageDeps {
  const contextDeps = {
    ruleEngine: { compile: () => "G1 … G10 rules", getCoreRules: () => ({ G1: "a", G2: "b" }) },
    skillCompiler: {
      resolve: (needs: string[]) => needs,
      compile: async () => ({ block: "skills", sources: ["tdd-workflow"], tokenCount: 120 }),
    },
    rag: { ensureIndexed: async () => 1, recall: () => [] },
    vault: { recall: () => [] },
    assembler: {
      assemble: async () => ({
        finalPrompt: "# SYSTEM — HARNESS COMPILED",
        breakdown: { skills: { tokens: 120, sources: ["tdd-workflow"] }, files: { tokens: 0, paths: [] }, totalTokens: 1200 },
      }),
    },
  };
  const pluginRunner = new SeedPluginRunner(SEED_PLUGINS, (name) => name !== "commit-guard");
  return {
    classify,
    compileContext: (input) => buildHarnessContext(input, contextDeps),
    runPreAgentPlugins: (context) => pluginRunner.runPreAgent(context),
    runPostAgentPlugins: (context) => pluginRunner.runPostAgent(context),
    runPreGates: () => ({ verdict: "pass" }),
    tokenLimit: 8000,
    model: "mock",
  };
}

describe("harness-first end-to-end", () => {
  it("runs the deterministic pipeline and replays it identically without an LLM", async () => {
    const repo = await makeRepo();
    const deps = makePipelineDeps();
    const input = { message: "agrega un endpoint /users", sessionId: "sess-e2e", workspacePath: repo.repoRoot };

    const original = await runDeterministicPipeline(input, deps);
    expect(original.stages.map((stage) => stage.stage)).toEqual([
      "ingress",
      "classify",
      "plugins",
      "context",
      "pre-gates",
      "post-gates",
    ]);

    const { identical, mismatches } = await replayDeterministic(original, deps);
    expect(mismatches).toEqual([]);
    expect(identical).toBe(true);
  });

  it("writes in a git worktree, passes the gates and merges to development", async () => {
    const repo = await makeRepo();
    const manager = new WorkspaceManager(repo.repoRoot, { worktreeRoot: repo.worktreeRoot });

    const worktree = await manager.create("task-e2e");
    const runner = new ToolRunner({ permission: "allow" });
    const observation = await runner.execute({
      tool: "fileEdit",
      args: { path: "src/users.ts", content: "export const users = [];\n" },
      sessionId: "sess-e2e",
      workspaceHash: worktree.branchName,
      workspacePath: worktree.worktreePath,
    });
    expect(observation.ok).toBe(true);
    expect(existsSync(join(worktree.worktreePath, "src/users.ts"))).toBe(true);
    expect(existsSync(join(repo.repoRoot, "src/users.ts"))).toBe(false);

    const report = await new VerificationLoop(passingCommandRunner, { visual: false }).verify({
      workspacePath: worktree.worktreePath,
      domain: "backend",
      diff: observation.diffPreview,
      coveragePct: 92,
    });
    expect(report.verdict).toBe("pass");

    const git = simpleGit(worktree.worktreePath);
    await git.add(["."]);
    await git.commit(["feat: add users module"]);

    const outcome = await manager.merge("task-e2e");
    expect(outcome.mergedCommit).toMatch(/^[0-9a-f]{4,}$/);
    expect(existsSync(join(repo.repoRoot, "src/users.ts"))).toBe(true);
    expect(readFileSync(join(repo.repoRoot, "src/users.ts"), "utf8")).toContain("users");
  });

  it("projects the token savings and 4th-message retention from the real compiled sizes", async () => {
    const deps = makePipelineDeps();
    const record = await runDeterministicPipeline(
      { message: "agrega un endpoint /users", sessionId: "s", workspacePath: "/ws" },
      deps
    );
    const snapshot = record.stages.find((stage) => stage.stage === "context")?.output as { skills: { tokens: number }; rules: { tokens: number } };
    const benchmark = benchmarkHarnessFirst({ turns: 4, rulesTokens: snapshot.rules.tokens, skillsTokens: snapshot.skills.tokens });
    expect(benchmark.tokensSaved).toBeGreaterThan(0);
    expect(benchmark.retentionAtFourthMessage).toEqual({ harnessFirst: 1, agentFirst: 0.4 });
  });
});
