import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { simpleGit } from "simple-git";
import { WorkspaceManager } from "../manager";
import { ToolRunner } from "../../tools/runner";

interface FixturePaths {
  repoRoot: string;
  worktreeRoot: string;
}

const FIXTURES: FixturePaths[] = [];

async function makeFixtureRepo(): Promise<FixturePaths> {
  const suffix = randomUUID().slice(0, 8);
  const repoRoot = join(tmpdir(), `phs14-repo-${suffix}`);
  const worktreeRoot = join(tmpdir(), `phs14-wt-${suffix}`);
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(worktreeRoot, { recursive: true });
  const fixtureGit = simpleGit(repoRoot);
  await fixtureGit.raw(["init", "-b", "development"]);
  await fixtureGit.addConfig("user.email", "harness@test.local");
  await fixtureGit.addConfig("user.name", "Harness Test");
  writeFileSync(join(repoRoot, "file.txt"), "base content\n", "utf8");
  await fixtureGit.add(["file.txt"]);
  await fixtureGit.commit(["seed commit"]);
  const paths = { repoRoot, worktreeRoot };
  FIXTURES.push(paths);
  return paths;
}

async function commitInRepo(repoPath: string, fileName: string, content: string, message: string): Promise<void> {
  writeFileSync(join(repoPath, fileName), content, "utf8");
  const repoGit = simpleGit(repoPath);
  await repoGit.add([fileName]);
  await repoGit.commit([message]);
}

afterEach(async () => {
  while (FIXTURES.length > 0) {
    const paths = FIXTURES.pop();
    if (!paths) break;
    try {
      const fixtureGit = simpleGit(paths.repoRoot);
      await fixtureGit.raw(["worktree", "prune"]).catch(() => undefined);
    } catch {
      continue;
    } finally {
      if (existsSync(paths.repoRoot)) rmSync(paths.repoRoot, { recursive: true, force: true });
      if (existsSync(paths.worktreeRoot)) rmSync(paths.worktreeRoot, { recursive: true, force: true });
    }
  }
});

describe("WorkspaceManager — git worktree per task", () => {
  let paths: FixturePaths;
  let manager: WorkspaceManager;

  beforeEach(async () => {
    paths = await makeFixtureRepo();
    manager = new WorkspaceManager(paths.repoRoot, { worktreeRoot: paths.worktreeRoot });
  });

  it("creates two parallel worktrees without collision", async () => {
    const first = await manager.create("task-alpha");
    const second = await manager.create("task-beta");
    expect(first.worktreePath).not.toBe(second.worktreePath);
    expect(first.branchName).not.toBe(second.branchName);
    expect(existsSync(first.worktreePath)).toBe(true);
    expect(existsSync(second.worktreePath)).toBe(true);
    expect(manager.list().filter((record) => record.status === "active")).toHaveLength(2);
  });

  it("runs ToolRunner file edits inside the worktree, not the Main repo", async () => {
    const record = await manager.create("task-tools");
    const runner = new ToolRunner({ permission: "allow" });
    const scopedInput = manager.scopeToolInput(
      { tool: "fileEdit" as const, args: { path: "from-agent.txt", content: "agent wrote this" }, sessionId: "sess-1", workspaceHash: "h1", workspacePath: paths.repoRoot },
      record.worktreePath
    );
    expect(scopedInput.workspacePath).toBe(record.worktreePath);
    const observation = await runner.execute(scopedInput);
    expect(observation.ok).toBe(true);
    expect(existsSync(join(record.worktreePath, "from-agent.txt"))).toBe(true);
    expect(existsSync(join(paths.repoRoot, "from-agent.txt"))).toBe(false);
  });

  it("verifies changed files after agent work", async () => {
    const record = await manager.create("task-verify");
    const cleanReport = await manager.verify(record.worktreePath);
    expect(cleanReport.isClean).toBe(true);
    await commitInRepo(record.worktreePath, "work.txt", "uncommitted change\n", "placeholder");
    const fixtureGit = simpleGit(record.worktreePath);
    await fixtureGit.reset(["--soft", "HEAD~1"]);
    const dirtyReport = await manager.verify(record.worktreePath);
    expect(dirtyReport.isClean).toBe(false);
    expect(dirtyReport.changedFiles.length).toBeGreaterThan(0);
  });

  it("predicts no conflict on clean branches and conflict on divergent edits", async () => {
    const record = await manager.create("task-conflict");
    const cleanPrediction = await manager.predictMergeConflicts(record.branchName, "development");
    expect(cleanPrediction.hasConflicts).toBe(false);
    await commitInRepo(record.worktreePath, "file.txt", "task version\n", "task edit");
    await commitInRepo(paths.repoRoot, "file.txt", "base version\n", "base edit");
    const conflictPrediction = await manager.predictMergeConflicts(record.branchName, "development");
    expect(conflictPrediction.hasConflicts).toBe(true);
    expect(conflictPrediction.conflictingFiles.length).toBeGreaterThan(0);
  });

  it("merges a non-conflicting task branch into the base", async () => {
    const record = await manager.create("task-merge");
    await commitInRepo(record.worktreePath, "merged.txt", "merge me\n", "task work");
    const outcome = await manager.merge("task-merge");
    expect(outcome.mergedCommit).toMatch(/^[0-9a-f]{4,}$/);
    expect(existsSync(join(paths.repoRoot, "merged.txt"))).toBe(true);
    expect(manager.get("task-merge")?.status).toBe("merged");
  });

  it("blocks merge when conflicts are predicted", async () => {
    await manager.create("task-blocked");
    const record = manager.get("task-blocked");
    if (!record) throw new Error("record missing");
    await commitInRepo(record.worktreePath, "file.txt", "task version\n", "task edit");
    await commitInRepo(paths.repoRoot, "file.txt", "base version\n", "base edit");
    await expect(manager.merge("task-blocked")).rejects.toThrow(/conflict/i);
  });

  it("discards a worktree and its branch", async () => {
    await manager.create("task-discard");
    const record = manager.get("task-discard");
    if (!record) throw new Error("record missing");
    await manager.discard("task-discard");
    expect(existsSync(record.worktreePath)).toBe(false);
    expect(manager.get("task-discard")?.status).toBe("discarded");
  });

  it("garbage-collects stale worktrees", async () => {
    await manager.create("task-stale");
    const removed = await manager.gc(-1);
    expect(removed).toContain("task-stale");
    expect(manager.get("task-stale")?.status).toBe("discarded");
  });
});
