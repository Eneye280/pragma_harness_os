import { existsSync, readdirSync } from "fs";
import type { StackDetection } from "../../shared/bundles";

const IGNORED_ENTRIES = new Set([".git", ".pragma-harness", ".harness", "node_modules", ".DS_Store"]);

const UNITY_MARKERS = ["Assets", "ProjectSettings", "Packages"];

export function detectStack(workspacePath: string): StackDetection {
  if (!existsSync(workspacePath)) return { blank: true, entries: 0, suggestions: [], markers: [] };
  const entries = readdirSync(workspacePath).filter((entry) => !IGNORED_ENTRIES.has(entry));
  const markers: string[] = [];
  const suggestions = new Set<string>();

  for (const entry of entries) {
    if (UNITY_MARKERS.includes(entry)) {
      markers.push(entry);
      suggestions.add("unity");
    } else if (entry.endsWith(".uproject")) {
      markers.push(entry);
      suggestions.add("unreal");
    } else if (entry === "package.json") {
      markers.push(entry);
      suggestions.add("web");
    } else if (entry === "tsconfig.json" || entry === "Dockerfile" || entry === "docker-compose.yml") {
      markers.push(entry);
      suggestions.add("backend");
    } else if (entry === "CMakeLists.txt" || entry.endsWith(".sln") || entry === "Cargo.toml") {
      markers.push(entry);
      suggestions.add("engine-vulkan");
    }
  }

  return { blank: entries.length === 0, entries: entries.length, suggestions: [...suggestions], markers };
}
