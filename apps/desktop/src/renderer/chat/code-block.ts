import type { CodeTokenKind } from "../explorer/code-tokens";

/** Clases de color por token; definidas en globals.css (`.tok-*`). */
export const TOKEN_CLASS: Record<CodeTokenKind, string> = {
  plain: "tok-plain",
  comment: "tok-comment",
  string: "tok-string",
  keyword: "tok-keyword",
  number: "tok-number",
  type: "tok-type",
  tag: "tok-tag",
  attr: "tok-attr",
  property: "tok-property",
  function: "tok-function",
  operator: "tok-operator",
  literal: "tok-literal",
  meta: "tok-meta",
};

const KNOWN_LANGUAGES = new Set([
  "ts", "tsx", "js", "jsx", "typescript", "javascript", "json", "yaml", "yml",
  "cs", "csharp", "glsl", "hlsl", "lua", "sql", "bash", "sh", "shell", "ps1", "powershell",
  "diff", "patch", "md", "markdown", "html", "htm", "xml", "svg", "css", "scss", "text",
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
