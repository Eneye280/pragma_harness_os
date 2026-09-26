import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { LicenseEntry } from "../../shared/licenses";

interface PackageJson {
  license?: string | { type?: string };
  version?: string;
}

function licenseOf(manifest: PackageJson): string {
  if (typeof manifest.license === "string") return manifest.license;
  if (manifest.license && typeof manifest.license.type === "string") return manifest.license.type;
  return "unknown";
}

export function buildInventory(workspacePath: string): LicenseEntry[] {
  const manifestPath = join(workspacePath, "package.json");
  if (!existsSync(manifestPath)) return [];
  let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return [];
  }
  const names = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
  const entries: LicenseEntry[] = [];
  for (const name of names) {
    const packageManifest = join(workspacePath, "node_modules", ...name.split("/"), "package.json");
    let license = "unknown";
    let version = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    if (existsSync(packageManifest)) {
      try {
        const parsed = JSON.parse(readFileSync(packageManifest, "utf8")) as PackageJson;
        license = licenseOf(parsed);
        version = parsed.version ?? version;
      } catch {
        // fall back to declared range + unknown license
      }
    }
    entries.push({ name, version, license, url: `https://www.npmjs.com/package/${name}` });
  }
  return entries;
}

export function listWorkspacePackages(workspacePath: string): string[] {
  const nodeModules = join(workspacePath, "node_modules");
  if (!existsSync(nodeModules)) return [];
  try {
    return readdirSync(nodeModules).filter((name) => !name.startsWith("."));
  } catch {
    return [];
  }
}
