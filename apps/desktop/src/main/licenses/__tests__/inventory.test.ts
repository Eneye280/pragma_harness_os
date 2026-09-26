import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { buildInventory, listWorkspacePackages } from "../inventory";

describe("license inventory", () => {
  let workspace = "";
  beforeEach(() => {
    workspace = join(tmpdir(), `phs84-lic-${randomUUID().slice(0, 8)}`);
    mkdirSync(join(workspace, "node_modules", "zod"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ dependencies: { zod: "^3.0.0" }, devDependencies: { vitest: "^2.0.0" } }), "utf8");
    writeFileSync(join(workspace, "node_modules", "zod", "package.json"), JSON.stringify({ version: "3.24.1", license: "MIT" }), "utf8");
  });
  afterEach(() => {
    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  });

  it("builds the inventory from package.json and node_modules", () => {
    const entries = buildInventory(workspace);
    expect(entries).toHaveLength(2);
    const zod = entries.find((entry) => entry.name === "zod");
    expect(zod).toMatchObject({ version: "3.24.1", license: "MIT" });
    const vitestEntry = entries.find((entry) => entry.name === "vitest");
    expect(vitestEntry?.license).toBe("unknown");
  });

  it("handles a workspace without package.json", () => {
    const empty = join(tmpdir(), `phs84-empty-${randomUUID().slice(0, 8)}`);
    mkdirSync(empty, { recursive: true });
    expect(buildInventory(empty)).toEqual([]);
    expect(listWorkspacePackages(empty)).toEqual([]);
    rmSync(empty, { recursive: true, force: true });
  });
});
