import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@shared/session";
import { basenameOf, groupSessionsByProject } from "../project-tree";

function session(id: string, workspacePath: string, updatedAt: number): SessionSummary {
  return { id, title: id, workspacePath, workspaceHash: "h", createdAt: 0, updatedAt, messageCount: 1 };
}

describe("project tree grouping", () => {
  it("extracts the folder name from a path", () => {
    expect(basenameOf("C:\\repo\\proyecto-a")).toBe("proyecto-a");
    expect(basenameOf("/home/dev/proyecto-b/")).toBe("proyecto-b");
    expect(basenameOf("solo")).toBe("solo");
  });

  it("puts the active project first and always includes it", () => {
    const groups = groupSessionsByProject([], "C:\\repo\\a", ["C:\\repo\\b"]);
    expect(groups[0].path).toBe("C:\\repo\\a");
    expect(groups[0].active).toBe(true);
    expect(groups[0].sessions).toEqual([]);
    expect(groups[1].path).toBe("C:\\repo\\b");
    expect(groups[1].active).toBe(false);
  });

  it("nests sessions under their project, newest first", () => {
    const groups = groupSessionsByProject(
      [session("old", "C:\\repo\\a", 1), session("new", "C:\\repo\\a", 5), session("other", "C:\\repo\\b", 3)],
      "C:\\repo\\a",
      [],
    );
    const projectA = groups.find((group) => group.path === "C:\\repo\\a");
    expect(projectA?.sessions.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(groups.find((group) => group.path === "C:\\repo\\b")?.sessions).toHaveLength(1);
  });

  it("does not duplicate a project present both as active and recent", () => {
    const groups = groupSessionsByProject([], "C:\\repo\\a", ["C:\\repo\\a", "C:\\repo\\b"]);
    expect(groups.filter((group) => group.path === "C:\\repo\\a")).toHaveLength(1);
  });
});
