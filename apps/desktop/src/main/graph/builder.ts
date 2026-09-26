import { dirname, extname, join, normalize } from "path";
import type { DependencyGraph, GraphEdge, GraphNode } from "../../shared/graph";

export interface GraphFile {
  path: string;
  content: string;
}

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const WEB_EXTENSIONS = [".html", ".htm", ".css"];
const RESOLVE_EXTENSIONS = [...TS_EXTENSIONS, ...WEB_EXTENSIONS, ".json", ".vue", ".svelte"];

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function parseImports(filePath: string, content: string): string[] {
  const extension = extname(filePath).toLowerCase();
  const specifiers: string[] = [];
  if ([".cs"].includes(extension)) {
    for (const match of content.matchAll(/^\s*using\s+([A-Za-z_][\w.]*)\s*;/gm)) specifiers.push(`ns:${match[1]}`);
    return [...new Set(specifiers)];
  }
  if (extension === ".html" || extension === ".htm") {
    for (const match of content.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)) specifiers.push(match[1]);
    for (const match of content.matchAll(/<link[^>]*\shref=["']([^"']+)["']/gi)) specifiers.push(match[1]);
    for (const match of content.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi)) specifiers.push(match[1]);
    return [...new Set(specifiers)];
  }
  if (extension === ".css") {
    for (const match of content.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)) specifiers.push(match[1]);
    for (const match of content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) specifiers.push(match[1]);
    return [...new Set(specifiers)];
  }
  if (TS_EXTENSIONS.includes(extension)) {
    const clean = stripComments(content);
    for (const match of clean.matchAll(/(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g)) specifiers.push(match[1]);
    for (const match of clean.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(match[1]);
    for (const match of clean.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

function resolveRelative(fromPath: string, specifier: string, known: Set<string>): string | null {
  const base = normalize(join(dirname(fromPath), specifier)).replace(/\\/g, "/");
  const candidates = [
    base,
    ...RESOLVE_EXTENSIONS.map((extension) => base + extension),
    ...RESOLVE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];
  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate;
  }
  const withTs = TS_EXTENSIONS.map((extension) => base + extension).find((candidate) => known.has(candidate));
  return withTs ?? null;
}

function detectCycles(edges: GraphEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function visit(node: string): void {
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (onStack.has(next)) {
        const start = stack.indexOf(next);
        const cycle = stack.slice(start);
        const key = [...cycle].sort().join(">");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (!stack.includes(next)) {
        visit(next);
      }
    }
    stack.pop();
    onStack.delete(node);
  }

  for (const node of adjacency.keys()) visit(node);
  return cycles;
}

export function buildDependencyGraph(files: GraphFile[]): DependencyGraph {
  const known = new Set(files.map((file) => file.path.replace(/\\/g, "/")));
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const file of files) {
    const id = file.path.replace(/\\/g, "/");
    nodes.set(id, { id, label: id.split("/").pop() ?? id, kind: "file" });
  }

  for (const file of files) {
    const from = file.path.replace(/\\/g, "/");
    for (const specifier of parseImports(file.path, file.content)) {
      if (specifier.startsWith("ns:")) {
        const id = specifier;
        if (!nodes.has(id)) nodes.set(id, { id, label: id.slice(3), kind: "namespace" });
        edges.push({ from, to: id });
        continue;
      }
      const external = /^[a-z]+:/i.test(specifier) || specifier.startsWith("//") || specifier.startsWith("#");
      if (external) continue;
      // En HTML/CSS las referencias ("app.js", "styles.css") son rutas sin "./".
      const normalized = specifier.startsWith(".") || specifier.startsWith("/") ? specifier : `./${specifier}`;
      const resolved = resolveRelative(file.path, normalized, known);
      if (resolved && resolved !== from) edges.push({ from, to: resolved });
    }
  }

  const uniqueEdges = [...new Map(edges.map((edge) => [`${edge.from}->${edge.to}`, edge])).values()];
  return {
    nodes: [...nodes.values()],
    edges: uniqueEdges,
    cycles: detectCycles(uniqueEdges),
    updatedAt: Date.now(),
  };
}
