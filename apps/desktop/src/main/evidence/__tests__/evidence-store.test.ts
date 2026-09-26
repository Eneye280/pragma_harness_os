import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { ensureEvidenceIgnored, evidencePath, saveEvidence } from "../evidence-store";

describe("visual evidence store", () => {
  let workspace = "";

  beforeEach(() => {
    workspace = join(tmpdir(), `phs80-${randomUUID().slice(0, 8)}`);
    mkdirSync(workspace, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  });

  it("writes the png inside the project evidence folder", () => {
    const saved = saveEvidence(workspace, "Task 42", Buffer.from([1, 2, 3]));
    expect(saved.path).toContain(join(".pragma-harness", "evidence"));
    expect(saved.path.endsWith(".png")).toBe(true);
    expect(existsSync(saved.path)).toBe(true);
    expect(evidencePath(workspace, "t")).toContain("evidence");
  });

  it("adds the evidence folder to .gitignore once", () => {
    writeFileSync(join(workspace, ".gitignore"), "node_modules/\n", "utf8");
    expect(ensureEvidenceIgnored(workspace)).toBe(true);
    expect(ensureEvidenceIgnored(workspace)).toBe(false);
    const content = readFileSync(join(workspace, ".gitignore"), "utf8");
    expect(content.match(/\.pragma-harness\/evidence\//g)?.length).toBe(1);
    expect(content).toContain("node_modules/");
  });

  it("works without a pre-existing .gitignore", () => {
    expect(ensureEvidenceIgnored(workspace)).toBe(true);
    expect(readFileSync(join(workspace, ".gitignore"), "utf8")).toContain(".pragma-harness/evidence/");
  });
});
