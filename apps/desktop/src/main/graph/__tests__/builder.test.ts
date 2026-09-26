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

  it("parses html script/link and css url references", () => {
    expect(parseImports("index.html", '<script src="app.js"></script>\n<link rel="stylesheet" href="styles.css">\n<img src="logo.png">')).toEqual([
      "app.js",
      "styles.css",
      "logo.png",
    ]);
    expect(parseImports("styles.css", '@import "base.css";\nbody { background: url(./bg.png); }')).toEqual(["base.css", "./bg.png"]);
  });

  it("links a web project through html and css even without js imports", () => {
    const graph = buildDependencyGraph([
      { path: "index.html", content: '<script src="app.js"></script><link href="styles.css" rel="stylesheet">' },
      { path: "app.js", content: "console.log('calculator');" },
      { path: "styles.css", content: "body { margin: 0; }" },
    ]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "index.html", to: "app.js" },
        { from: "index.html", to: "styles.css" },
      ])
    );
  });
});
