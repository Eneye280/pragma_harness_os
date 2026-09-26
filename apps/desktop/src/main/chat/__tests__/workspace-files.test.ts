import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildWorkspaceBlock, renderWorkspaceFiles } from "../workspace-files";

describe("workspace files block", () => {
  it("returns an empty string with no files", () => {
    expect(renderWorkspaceFiles([])).toBe("");
  });

  it("lists files with a header and count", () => {
    const block = renderWorkspaceFiles(["calc-harness/index.html", "calc-harness/script.js"]);
    expect(block).toContain("[workspace files] (2 archivos)");
    expect(block).toContain("- calc-harness/index.html");
    expect(block).toContain("- calc-harness/script.js");
  });

  it("truncates long listings with a remainder note", () => {
    const files = Array.from({ length: 130 }, (_, index) => `src/file-${index}.ts`);
    const block = renderWorkspaceFiles(files);
    expect(block).toContain("… y 10 más");
  });

  it("inlines the content of small project files so the agent reads real code", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phs-ws-"));
    mkdirSync(join(dir, "calc-harness"), { recursive: true });
    writeFileSync(join(dir, "calc-harness", "script.js"), "export const sum = (a, b) => a + b;\n", "utf8");
    writeFileSync(join(dir, "calc-harness", "styles.css"), "body { margin: 0; }\n", "utf8");

    const block = await buildWorkspaceBlock(dir, "revisa calc-harness/script.js");
    expect(block).toContain("[workspace files] (2 archivos)");
    expect(block).toContain("[workspace content]");
    expect(block).toContain("export const sum = (a, b) => a + b;");
  });

  it("returns empty for a missing workspace", async () => {
    expect(await buildWorkspaceBlock(null, "hola")).toBe("");
  });
});
