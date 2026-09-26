import { execFile } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import fastGlob from "fast-glob";
import { resolveInsideWorkspace } from "../tools/file-tools";
import { captureHtmlPage } from "./html-capture";
import { detectPackageManager, orderedScriptNames, packageRunArgs, type PackageManager, type QaProjectReport, type QaProjectStep } from "../../shared/qa";

export type { QaProjectReport, QaProjectStep } from "../../shared/qa";

const SCRIPT_TIMEOUT_MS = 180_000;

function runScript(workspacePath: string, manager: PackageManager, script: string): Promise<QaProjectStep> {
  const started = Date.now();
  const command = process.platform === "win32" ? `${manager}.cmd` : manager;
  return new Promise((resolve) => {
    execFile(
      command,
      packageRunArgs(manager, script),
      { cwd: workspacePath, timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, shell: process.platform === "win32" },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
        const tail = output.slice(-800);
        resolve({
          name: `${manager} ${script}`,
          ok: !error,
          detail: error ? (tail || (error as Error).message) : tail.split("\n").slice(-6).join("\n") || "ok",
          durationMs: Date.now() - started,
        });
      },
    );
  });
}

function findHtmlEntry(workspacePath: string): string | null {
  for (const candidate of ["index.html", "public/index.html", "src/index.html", "dist/index.html"]) {
    try {
      if (existsSync(resolveInsideWorkspace(workspacePath, candidate))) return candidate;
    } catch {
      continue;
    }
  }
  try {
    const matches = fastGlob
      .sync(["**/index.html", "**/*.html"], { cwd: workspacePath, onlyFiles: true, deep: 4, ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/out/**"] })
      .sort((left, right) => left.split("/").length - right.split("/").length || left.length - right.length);
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Verificación real del proyecto: corre los scripts de package.json y, si es
 * una web, abre el HTML y captura pantalla + errores de consola.
 */
export async function runProjectQa(workspacePath: string | null | undefined): Promise<QaProjectReport> {
  const steps: QaProjectStep[] = [];
  const consoleErrors: string[] = [];
  if (!workspacePath) return { ok: false, stack: "unknown", steps: [{ name: "workspace", ok: false, detail: "sin proyecto abierto" }], consoleErrors };

  const packageJsonPath = join(workspacePath, "package.json");
  let stack: QaProjectReport["stack"] = "unknown";

  let rootFiles: string[] = [];
  try {
    rootFiles = readdirSync(workspacePath);
  } catch {
    rootFiles = [];
  }
  const manager = detectPackageManager(rootFiles);

  if (manager) {
    stack = "node";
    let scripts: Record<string, string> = {};
    if (existsSync(packageJsonPath)) {
      try {
        scripts = (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
      } catch {
        scripts = {};
      }
    }
    const present = orderedScriptNames(scripts);
    steps.push({ name: "gestor detectado", ok: true, detail: manager });
    if (present.length === 0) steps.push({ name: "scripts", ok: true, detail: "sin scripts lint/typecheck/test/build" });
    for (const script of present) steps.push(await runScript(workspacePath, manager, script));
  }

  const htmlEntry = findHtmlEntry(workspacePath);
  if (htmlEntry) {
    stack = stack === "unknown" ? "web" : stack;
    const absolute = resolveInsideWorkspace(workspacePath, htmlEntry);
    const capture = await captureHtmlPage(absolute);
    steps.push({ name: `abrir ${htmlEntry}`, ok: capture.ok, detail: capture.ok ? `${capture.title || "sin título"} · ${capture.detail}` : capture.detail });
    if (capture.ok && capture.png) {
      const evidenceDir = join(workspacePath, ".pragma-harness", "evidence");
      mkdirSync(evidenceDir, { recursive: true });
      const screenshotPath = join(evidenceDir, `qa-${Date.now()}.png`);
      try {
        writeFileSync(screenshotPath, capture.png);
      } catch {
        // evidencia best-effort
      }
      consoleErrors.push(...capture.consoleErrors);
      steps.push({
        name: "consola del navegador",
        ok: capture.consoleErrors.length === 0,
        detail: capture.consoleErrors.length === 0 ? "sin errores" : capture.consoleErrors.slice(0, 5).join(" | "),
      });
      const report: QaProjectReport = {
        ok: steps.every((step) => step.ok),
        stack,
        steps,
        consoleErrors,
        screenshotPath,
        screenshotDataUrl: `data:image/png;base64,${capture.png.toString("base64")}`,
      };
      return report;
    }
  }

  if (steps.length === 0) {
    steps.push({ name: "verificación", ok: false, detail: "no hay package.json ni index.html que verificar" });
  }
  return { ok: steps.every((step) => step.ok), stack, steps, consoleErrors };
}
