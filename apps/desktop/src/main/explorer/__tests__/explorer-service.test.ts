import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { simpleGit } from "simple-git";
import { ExplorerService, classifyGitStatus, languageForPath } from "../service";

const FIXTURES: string[] = [];

async function makeWorkspace(withGit: boolean): Promise<string> {
  const workspace = join(tmpdir(), `phs20-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspace, "src", "chat"), { recursive: true });
  writeFileSync(join(workspace, "README.md"), "# Demo\n", "utf8");
  writeFileSync(join(workspace, "src", "index.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(workspace, "src", "chat", "reducer.ts"), "export const r = 2;\n", "utf8");
  if (withGit) {
    const git = simpleGit(workspace);
    await git.raw(["init", "-b", "main"]);
    await git.addConfig("user.email", "harness@test.local");
    await git.addConfig("user.name", "Harness Test");
    await git.add(["."]);
    await git.commit(["seed"]);
  }
  FIXTURES.push(workspace);
  return workspace;
}

afterEach(() => {
  while (FIXTURES.length > 0) {
    const workspace = FIXTURES.pop();
    if (workspace && existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  }
});

describe("ExplorerService", () => {
  let workspace = "";
  let service: ExplorerService;

  beforeEach(async () => {
    workspace = await makeWorkspace(true);
    service = new ExplorerService(workspace);
  });

  it("builds a tree with directories before files", async () => {
    const tree = await service.getTree();
    expect(tree.fileCount).toBe(3);
    const topNames = tree.nodes.map((node) => node.name);
    expect(topNames).toEqual(["src", "README.md"]);
    const src = tree.nodes.find((node) => node.path === "src");
    expect(src?.children?.map((node) => node.name)).toEqual(["chat", "index.ts"]);
  });

  it("flags an untracked file and a modified file from git status", async () => {
    writeFileSync(join(workspace, "nuevo.txt"), "sin trackear\n", "utf8");
    writeFileSync(join(workspace, "README.md"), "# Demo cambió\n", "utf8");
    const tree = await service.getTree();
    const statusMap = await service.gitStatusMap();
    expect(statusMap.get("nuevo.txt")).toBe("untracked");
    expect(statusMap.get("README.md")).toBe("modified");
    const readme = tree.nodes.find((node) => node.path === "README.md");
    expect(readme?.gitStatus).toBe("modified");
  });

  it("reads a file with language detection and truncation flag", () => {
    const file = service.readFile("src/index.ts");
    expect(file.content).toContain("export const a = 1;");
    expect(file.language).toBe("typescript");
    expect(file.truncated).toBe(false);
    expect(file.binary).toBe(false);
  });

  it("detects binary files", () => {
    writeFileSync(join(workspace, "blob.bin"), Buffer.from([0x00, 0x01, 0x02, 0x00]));
    const file = service.readFile("blob.bin");
    expect(file.binary).toBe(true);
    expect(file.content).toBe("");
  });

  it("refuses paths that escape the workspace", () => {
    expect(() => service.readFile("../../secret.txt")).toThrow(/escapes workspace/);
  });

  it("classifies git status codes and languages", () => {
    expect(classifyGitStatus("?", "?")).toBe("untracked");
    expect(classifyGitStatus(" ", "M")).toBe("modified");
    expect(classifyGitStatus("M", " ")).toBe("staged");
    expect(classifyGitStatus("U", "U")).toBe("conflicted");
    expect(languageForPath("a/b.tsx")).toBe("typescript");
    expect(languageForPath("a/b.unknownext")).toBe("plaintext");
  });
});
