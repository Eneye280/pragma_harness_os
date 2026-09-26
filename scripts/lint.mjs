#!/usr/bin/env node
/**
 * Linter propio del harness (sin dependencias): usa el compilador de TypeScript
 * para recorrer el AST y hacer cumplir reglas específicas del proyecto.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import ts from "typescript";

function findRepoRoot(start) {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return start;
}

const ROOT = findRepoRoot(process.cwd());
const TARGETS = ["apps/desktop/src", "packages/harness-core/src", "packages/harness-sdk/src"];
const SKIP = /(^|[\\/])(node_modules|dist|out|build|coverage|__tests__)([\\/]|$)|\.test\.(ts|tsx)$/;
const CONSOLE_LOG_ALLOWED = /main[\\/]server[\\/]hono\.ts$/;

const rules = [];

function walk(dir, files = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (SKIP.test(full)) continue;
    const info = statSync(full);
    if (info.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function report(file, line, rule, message) {
  rules.push({ file: relative(ROOT, file).split(sep).join("/"), line, rule, message });
}

function checkComments(text, file) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/@ts-ignore|@ts-expect-error/.test(line)) report(file, index + 1, "no-ts-suppress", line.trim());
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) report(file, index + 1, "no-todo-comments", line.trim().slice(0, 120));
  });
}

function checkAst(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression) && expression.getText(source) === "console.log" && !CONSOLE_LOG_ALLOWED.test(file)) {
        report(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, "no-console-log", "usa el logger o elimina console.log");
      }
    }
    if (ts.isDebuggerStatement(node)) {
      report(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, "no-debugger", "debugger prohibido");
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      report(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, "no-explicit-any", "usa un tipo concreto o unknown");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const files = TARGETS.flatMap((target) => walk(join(ROOT, target)));
for (const file of files) {
  const text = readFileSync(file, "utf8");
  checkComments(text, file);
  checkAst(file, text);
}

if (rules.length === 0) {
  console.log(`lint OK — ${files.length} archivos, 0 problemas`);
  process.exit(0);
}

for (const entry of rules) console.error(`${entry.file}:${entry.line}  [${entry.rule}] ${entry.message}`);
console.error(`\nlint FALLÓ — ${rules.length} problema(s) en ${files.length} archivos`);
process.exit(1);
