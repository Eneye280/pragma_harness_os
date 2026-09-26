import { describe, expect, it } from "vitest";
import { buildDependencyGraph, parseImports } from "../builder";

describe("dependency graph builder", () => {
  it("parses ts/js imports including require and dynamic import", () => {
    const specifiers = parseImports(
      "src/a.ts",
      [
        'import { x } from "./b";',
        'import y from "../c/d";',
        'export { z } from "./e";',
        'const w = require("./f");',
        'const d = import("./g");',
        'import react from "react";',
        "// import { bad } from './commented'",
      ].join("\n")
    );
    expect(specifiers).toEqual(["./b", "../c/d", "./e", "react", "./f", "./g"]);
  });

  it("parses C# using directives as namespaces", () => {
    const specifiers = parseImports("Scripts/Foo.cs", "using System;\nusing My.Game.Core;\n");
    expect(specifiers).toEqual(["ns:System", "ns:My.Game.Core"]);
  });

  it("resolves relative imports to existing files and skips bare packages", () => {
    const graph = buildDependencyGraph([
      { path: "src/a.ts", content: 'import { b } from "./b";\nimport react from "react";' },
      { path: "src/b.ts", content: 'export const b = 1;' },
      { path: "src/c.ts", content: 'import { b } from "./b";' },
    ]);
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "src/a.ts", to: "src/b.ts" },
        { from: "src/c.ts", to: "src/b.ts" },
      ])
    );
    expect(graph.edges).toHaveLength(2);
  });

  it("adds namespace nodes for C# projects", () => {
    const graph = buildDependencyGraph([{ path: "Game/Player.cs", content: "using Unity.Engine;\n" }]);
    expect(graph.nodes.some((node) => node.id === "ns:Unity.Engine" && node.kind === "namespace")).toBe(true);
    expect(graph.edges).toContainEqual({ from: "Game/Player.cs", to: "ns:Unity.Engine" });
  });

  it("detects cycles", () => {
    const graph = buildDependencyGraph([
      { path: "src/a.ts", content: 'import "./b";' },
      { path: "src/b.ts", content: 'import "./a";' },
      { path: "src/c.ts", content: 'import "./a";' },
    ]);
    expect(graph.cycles.length).toBe(1);
    expect(graph.cycles[0].sort()).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
