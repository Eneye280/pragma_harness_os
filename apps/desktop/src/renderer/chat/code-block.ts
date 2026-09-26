import type { CodeTokenKind } from "../explorer/code-tokens";

export const TOKEN_CLASS: Record<CodeTokenKind, string> = {
  plain: "text-zinc-300",
  comment: "text-zinc-500 italic",
  string: "text-emerald-300",
  keyword: "text-harness-soft",
  number: "text-amber-300",
};

const KNOWN_LANGUAGES = new Set([
  "ts", "tsx", "js", "jsx", "typescript", "javascript", "json", "yaml", "yml",
  "cs", "csharp", "glsl", "hlsl", "lua", "sql", "bash", "sh", "shell", "diff", "md", "markdown", "html", "css",
]);

export function sanitizeLang(lang: string): string {
  const normalized = (lang || "").trim().toLowerCase();
  return KNOWN_LANGUAGES.has(normalized) ? normalized : normalized ? normalized : "text";
}

export type DiffTone = "add" | "remove" | "meta" | "none";

export function diffTone(line: string, lang: string): DiffTone {
  if (!isDiffLanguage(lang)) return "none";
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "remove";
  if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("+++") || line.startsWith("---")) return "meta";
  return "none";
}

export function isDiffLanguage(lang: string): boolean {
  const normalized = lang.trim().toLowerCase();
  return normalized === "diff" || normalized === "patch";
}

export function codeBlockLabel(lang: string): string {
  return sanitizeLang(lang).toUpperCase();
}
