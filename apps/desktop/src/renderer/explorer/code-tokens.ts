export type CodeTokenKind =
  | "plain"
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "type"
  | "tag"
  | "attr"
  | "property"
  | "function"
  | "operator"
  | "literal"
  | "meta";

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

export type LanguageFamily =
  | "js" | "json" | "html" | "css" | "cs" | "lua" | "sql" | "yaml" | "shell" | "glsl"
  | "py" | "ruby" | "rust" | "go" | "java" | "kotlin" | "php" | "text";

export function languageFamily(language: string): LanguageFamily {
  const lang = language.trim().toLowerCase();
  if (["ts", "tsx", "js", "jsx", "typescript", "javascript", "mjs", "cjs"].includes(lang)) return "js";
  if (lang === "json") return "json";
  if (["html", "htm", "xml", "svg", "vue"].includes(lang)) return "html";
  if (["css", "scss", "less"].includes(lang)) return "css";
  if (["cs", "csharp"].includes(lang)) return "cs";
  if (lang === "lua") return "lua";
  if (lang === "sql") return "sql";
  if (["yaml", "yml", "toml", "ini", "cfg", "conf"].includes(lang)) return "yaml";
  if (["bash", "sh", "shell", "zsh", "powershell", "ps1", "dockerfile", "docker"].includes(lang)) return "shell";
  if (["glsl", "hlsl", "wgsl"].includes(lang)) return "glsl";
  if (["py", "python"].includes(lang)) return "py";
  if (["rb", "ruby"].includes(lang)) return "ruby";
  if (["rs", "rust"].includes(lang)) return "rust";
  if (["go", "golang"].includes(lang)) return "go";
  if (lang === "java") return "java";
  if (["kt", "kotlin"].includes(lang)) return "kotlin";
  if (lang === "php") return "php";
  return "text";
}

const KEYWORDS: Record<LanguageFamily, Set<string>> = {
  js: new Set([
    "import", "from", "export", "default", "const", "let", "var", "function", "return", "if", "else",
    "for", "while", "do", "switch", "case", "break", "continue", "class", "extends", "implements",
    "new", "async", "await", "yield", "try", "catch", "finally", "throw", "interface", "type", "enum",
    "public", "private", "protected", "static", "readonly", "as", "in", "of", "typeof", "instanceof",
    "delete", "void", "this", "super", "satisfies", "keyof", "declare", "namespace", "abstract", "get", "set",
  ]),
  json: new Set(),
  html: new Set(),
  css: new Set(["important", "inherit", "initial", "unset", "none", "auto", "flex", "grid", "block", "inline", "inline-block", "absolute", "relative", "fixed", "sticky", "hidden", "bold", "normal"]),
  cs: new Set([
    "using", "namespace", "class", "interface", "struct", "enum", "public", "private", "protected", "internal",
    "static", "readonly", "const", "void", "var", "new", "return", "if", "else", "for", "foreach", "while",
    "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "this", "base", "override",
    "virtual", "abstract", "async", "await", "get", "set", "partial", "sealed", "record", "in", "out", "ref",
  ]),
  lua: new Set(["local", "function", "end", "if", "then", "else", "elseif", "for", "while", "do", "repeat", "until", "return", "break", "and", "or", "not", "nil", "true", "false", "in", "require", "self"]),
  sql: new Set(["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "alter", "drop", "join", "left", "right", "inner", "outer", "on", "group", "by", "order", "limit", "offset", "and", "or", "not", "null", "as", "distinct", "count", "sum", "avg", "primary", "key", "foreign", "references", "index", "returning", "conflict", "do", "nothing"]),
  yaml: new Set(["true", "false", "null", "yes", "no"]),
  shell: new Set(["if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while", "case", "esac", "function", "return", "export", "local", "echo", "cd", "set", "source"]),
  glsl: new Set(["void", "float", "int", "bool", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4", "sampler2D", "uniform", "varying", "attribute", "in", "out", "inout", "const", "return", "if", "else", "for", "while", "discard", "precision", "highp", "mediump", "lowp", "layout", "struct"]),
  py: new Set([
    "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else",
    "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
    "or", "pass", "raise", "return", "try", "while", "with", "yield", "True", "False", "None", "self", "match", "case",
  ]),
  ruby: new Set([
    "alias", "and", "begin", "break", "case", "class", "def", "do", "else", "elsif", "end", "ensure", "false",
    "for", "if", "in", "module", "next", "nil", "not", "or", "redo", "rescue", "retry", "return", "self", "super",
    "then", "true", "undef", "unless", "until", "when", "while", "yield", "require", "attr_accessor", "attr_reader",
  ]),
  rust: new Set([
    "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false",
    "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
    "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while",
  ]),
  go: new Set([
    "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go",
    "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type",
    "var", "nil", "true", "false",
  ]),
  java: new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
    "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public",
    "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try",
    "void", "volatile", "while", "var", "record", "sealed", "permits",
  ]),
  kotlin: new Set([
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null",
    "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "val", "var", "when",
    "while", "suspend", "data", "sealed", "override", "private", "public", "protected", "internal", "open",
    "companion", "init", "by",
  ]),
  php: new Set([
    "abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const", "continue",
    "declare", "default", "do", "echo", "else", "elseif", "empty", "enum", "extends", "final", "finally", "fn",
    "for", "foreach", "function", "global", "if", "implements", "include", "instanceof", "interface", "isset",
    "list", "match", "namespace", "new", "or", "print", "private", "protected", "public", "readonly", "require",
    "return", "static", "switch", "throw", "trait", "try", "unset", "use", "var", "while", "xor", "yield",
    "true", "false", "null",
  ]),
  text: new Set(),
};

const HASH_COMMENT: LanguageFamily[] = ["yaml", "shell", "py", "ruby", "php"];
const SLASH_COMMENT: LanguageFamily[] = ["lua", "sql", "glsl", "js", "cs", "rust", "go", "java", "kotlin", "php"];
const BLOCK_COMMENT: LanguageFamily[] = ["cs", "css", "js", "rust", "go", "java", "kotlin", "php"];
const DASH_COMMENT: LanguageFamily[] = ["lua", "sql"];

const LITERALS = new Set(["true", "false", "null", "undefined", "nil", "NaN", "Infinity"]);
const JS_BUILTINS = new Set(["console", "document", "window", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Promise", "Map", "Set", "Date", "RegExp"]);

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/y;
const NUMBER = /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y;

function push(tokens: CodeToken[], text: string, kind: CodeTokenKind): void {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) last.text += text;
  else tokens.push({ text, kind });
}

function scanLine(line: string, family: LanguageFamily, tokens: CodeToken[]): void {
  const keywords = KEYWORDS[family];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    const rest = line.slice(i);

    // Comentarios
    if (family === "html" && rest.startsWith("<!--")) {
      const end = rest.indexOf("-->");
      const text = end === -1 ? rest : rest.slice(0, end + 3);
      push(tokens, text, "comment");
      i += text.length;
      continue;
    }
    if (SLASH_COMMENT.includes(family) && rest.startsWith("//")) {
      push(tokens, rest, "comment");
      return;
    }
    if (DASH_COMMENT.includes(family) && rest.startsWith("--")) {
      push(tokens, rest, "comment");
      return;
    }
    if (BLOCK_COMMENT.includes(family) && rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      push(tokens, text, "comment");
      i += text.length;
      continue;
    }
    if (HASH_COMMENT.includes(family) && ch === "#") {
      push(tokens, rest, "comment");
      return;
    }

    // Strings
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === ch) {
          j += 1;
          break;
        }
        j += 1;
      }
      const isJsonKey = family === "json" && /^\s*:/.test(line.slice(j));
      push(tokens, line.slice(i, j), isJsonKey ? "property" : "string");
      i = j;
      continue;
    }

    // Números
    NUMBER.lastIndex = i;
    const numberMatch = NUMBER.exec(line);
    if (numberMatch && numberMatch.index === i) {
      push(tokens, numberMatch[0], "number");
      i += numberMatch[0].length;
      continue;
    }

    // Identificadores / palabras clave
    IDENTIFIER.lastIndex = i;
    const idMatch = IDENTIFIER.exec(line);
    if (idMatch && idMatch.index === i) {
      const word = idMatch[0];
      const next = line[i + word.length];
      const isCall = next === "(";
      const prev = line.slice(0, i).trimEnd();
      const isCssProperty = family === "css" && next === ":";
      const isJsonKey = family === "json" && line.slice(i + word.length).trimStart().startsWith(":");
      const isYamlKey = family === "yaml" && next === ":";
      const isHtmlTag = family === "html" && /[<>/]/.test(prev.slice(-1)) && next !== "=";
      const isHtmlAttr = family === "html" && next === "=";

      if (LITERALS.has(word)) push(tokens, word, "literal");
      else if (keywords.has(word.toLowerCase())) push(tokens, word, "keyword");
      else if (isCssProperty) push(tokens, word, "property");
      else if (isJsonKey || isYamlKey) push(tokens, word, "property");
      else if (isHtmlTag) push(tokens, word, "tag");
      else if (isHtmlAttr) push(tokens, word, "attr");
      else if (isCall) push(tokens, word, "function");
      else if (family === "js" && JS_BUILTINS.has(word)) push(tokens, word, "type");
      else if (/^[A-Z]/.test(word)) push(tokens, word, "type");
      else push(tokens, word, "plain");
      i += word.length;
      continue;
    }

    // Operadores y puntuación
    if ("=+-*/%<>!&|^~?:.".includes(ch)) {
      push(tokens, ch, "operator");
      i += 1;
      continue;
    }
    push(tokens, ch, "plain");
    i += 1;
  }

  if (family === "yaml" && tokens.length > 0 && tokens[0].kind === "plain" && tokens[0].text.trim().length > 0 && line.includes(":")) {
    // clave yaml sin comillas: ya se marcó por `next === ':'`
  }
}

export function tokenizeLine(line: string, language: string): CodeToken[] {
  const family = language === "diff" ? "text" : languageFamily(language);
  const tokens: CodeToken[] = [];
  scanLine(line, family, tokens);
  return tokens.length > 0 ? tokens : [{ text: "", kind: "plain" }];
}

export function tokenizeCode(content: string, language: string): CodeToken[][] {
  return content.split("\n").map((line) => tokenizeLine(line, language));
}
