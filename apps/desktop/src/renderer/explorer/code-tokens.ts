export type CodeTokenKind = "plain" | "comment" | "string" | "keyword" | "number";

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

const KEYWORDS = new Set([
  "import", "from", "export", "default", "const", "let", "var", "function", "return", "if", "else",
  "for", "while", "class", "extends", "new", "async", "await", "yield", "try", "catch", "finally",
  "throw", "interface", "type", "enum", "public", "private", "protected", "static", "readonly",
  "true", "false", "null", "undefined", "void", "this", "super", "as", "in", "of", "typeof",
]);

const HASH_COMMENT_LANGUAGES = new Set(["yaml", "shell", "glsl"]);

const TOKEN_PATTERN = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;

export function tokenizeLine(line: string, language: string): CodeToken[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//")) return [{ text: line, kind: "comment" }];
  if (HASH_COMMENT_LANGUAGES.has(language) && trimmed.startsWith("#")) {
    return [{ text: line, kind: "comment" }];
  }

  const tokens: CodeToken[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    if (match.index > cursor) tokens.push({ text: line.slice(cursor, match.index), kind: "plain" });
    const [full, comment, stringLiteral, number, identifier] = match;
    if (comment) tokens.push({ text: full, kind: "comment" });
    else if (stringLiteral) tokens.push({ text: full, kind: "string" });
    else if (number) tokens.push({ text: full, kind: "number" });
    else if (identifier && KEYWORDS.has(identifier)) tokens.push({ text: full, kind: "keyword" });
    else tokens.push({ text: full, kind: "plain" });
    cursor = match.index + full.length;
  }

  if (cursor < line.length) tokens.push({ text: line.slice(cursor), kind: "plain" });
  return tokens.length > 0 ? tokens : [{ text: "", kind: "plain" }];
}

export function tokenizeCode(content: string, language: string): CodeToken[][] {
  return content.split("\n").map((line) => tokenizeLine(line, language));
}
