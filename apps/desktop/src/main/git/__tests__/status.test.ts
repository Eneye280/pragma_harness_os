import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { simpleGit } from "simple-git";
import { GitStatusService } from "../status";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "phs37-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe("GitStatusService", () => {
  it("reports a non-repo workspace as isRepo false", async () => {
    const service = new GitStatusService();
    const root = makeRoot();
    const status = await service.getStatus(root);
    expect(status.isRepo).toBe(false);
    expect(status.branch).toBeNull();
    expect(status.changedCount).toBe(0);
  });

  it("reports the current branch and cleanliness of a repo", async () => {
    const service = new GitStatusService();
    const root = makeRoot();
    const git = simpleGit(root);
    await git.raw(["init", "-b", "main"]);
    await git.addConfig("user.email", "git@test.local");
    await git.addConfig("user.name", "Git Test");
    writeFileSync(join(root, "README.md"), "# repo\n", "utf8");
    await git.add(["README.md"]);
    await git.commit(["seed"]);

    const clean = await service.getStatus(root);
    expect(clean.isRepo).toBe(true);
    expect(clean.branch).toBe("main");
    expect(clean.detached).toBe(false);
    expect(clean.dirty).toBe(false);
    expect(clean.changedCount).toBe(0);
  });

  it("reports a dirty workspace with the changed file count", async () => {
    const service = new GitStatusService();
    const root = makeRoot();
    const git = simpleGit(root);
    await git.raw(["init", "-b", "main"]);
    await git.addConfig("user.email", "git@test.local");
    await git.addConfig("user.name", "Git Test");
    writeFileSync(join(root, "README.md"), "# repo\n", "utf8");
    await git.add(["README.md"]);
    await git.commit(["seed"]);

    writeFileSync(join(root, "untracked.txt"), "hola\n", "utf8");
    const dirty = await service.getStatus(root);
    expect(dirty.isRepo).toBe(true);
    expect(dirty.dirty).toBe(true);
    expect(dirty.changedCount).toBeGreaterThanOrEqual(1);
  });
});
