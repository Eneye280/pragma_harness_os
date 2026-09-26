import { readFileSync, statSync } from "fs";
import { join } from "path";
import fastGlob from "fast-glob";

const IGNORED = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/out/**", "**/build/**", "**/coverage/**", "**/.pragma-harness/**"];
const TEXT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".html", ".htm", ".css", ".yml", ".yaml", ".sql", ".cs", ".lua", ".glsl", ".txt", ".env"];
const MAX_FILE_BYTES = 8000;
const MAX_TOTAL_BYTES = 40_000;
const MAX_INLINE_FILES = 14;

/**
 * Lista de archivos del proyecto (rutas relativas) para que el agente sepa
 * sobre qué está trabajando sin adivinar. Se inyecta en el prompt.
 */
export async function listWorkspaceFiles(workspacePath: string | null | undefined, limit = 150): Promise<string[]> {
  if (!workspacePath) return [];
  try {
    const files = await fastGlob("**/*", {
      cwd: workspacePath,
      onlyFiles: true,
      dot: false,
      ignore: IGNORED,
      followSymbolicLinks: false,
      deep: 6,
    });
    return files.sort().slice(0, limit);
  } catch {
    return [];
  }
}

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function mentionScore(path: string, message: string): number {
  const base = (path.split(/[\\/]/).pop() ?? "").toLowerCase();
  const lowerMessage = message.toLowerCase();
  if (base && lowerMessage.includes(base)) return 3;
  const folder = path.split(/[\\/]/).slice(0, -1).join("/").toLowerCase();
  if (folder && lowerMessage.includes(folder)) return 2;
  if (lowerMessage.includes(path.toLowerCase())) return 3;
  return 1;
}

/**
 * Bloque de contexto del proyecto: lista de archivos + contenido de los
 * archivos pequeños relevantes. Así el agente analiza el código real sin
 * depender de que acierte el formato de tool.
 */
export async function buildWorkspaceBlock(workspacePath: string | null | undefined, message: string): Promise<string> {
  const files = await listWorkspaceFiles(workspacePath);
  if (files.length === 0 || !workspacePath) return "";

  const candidates = files
    .filter(isTextFile)
    .map((path) => ({ path, score: mentionScore(path, message) }))
    .sort((left, right) => right.score - left.score);

  const included: string[] = [];
  let total = 0;
  for (const candidate of candidates) {
    if (included.length >= MAX_INLINE_FILES || total >= MAX_TOTAL_BYTES) break;
    try {
      const absolute = join(workspacePath, candidate.path);
      if (statSync(absolute).size > MAX_FILE_BYTES) continue;
      const content = readFileSync(absolute, "utf8");
      if (total + content.length > MAX_TOTAL_BYTES) continue;
      total += content.length;
      included.push(`--- ${candidate.path} ---\n${content}`);
    } catch {
      continue;
    }
  }

  return [
    renderWorkspaceFiles(files),
    included.length > 0 ? `\n[workspace content] (${included.length} archivos incluidos)\n${included.join("\n\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderWorkspaceFiles(files: string[]): string {
  if (files.length === 0) return "";
  const shown = files.slice(0, 120);
  const extra = files.length - shown.length;
  return [
    `[workspace files] (${files.length} archivos)`,
    ...shown.map((file) => `- ${file}`),
    ...(extra > 0 ? [`… y ${extra} más`] : []),
  ].join("\n");
}

