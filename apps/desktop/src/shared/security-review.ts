export interface SecurityFinding {
  rule: string;
  line: string;
  severity: "high" | "medium" | "low";
  advice: string;
}

const RULES: Array<{ rule: string; pattern: RegExp; severity: SecurityFinding["severity"]; advice: string }> = [
  { rule: "eval", pattern: /\beval\s*\(/, severity: "high", advice: "evita eval; usa parseo explícito" },
  { rule: "new Function", pattern: /new\s+Function\s*\(/, severity: "high", advice: "evita construir funciones desde strings" },
  { rule: "innerHTML", pattern: /\.innerHTML\s*=/, severity: "medium", advice: "usa textContent o sanitiza el HTML" },
  { rule: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/, severity: "high", advice: "sanitiza antes de inyectar HTML" },
  { rule: "child_process", pattern: /child_process|\bexecSync\b|\bexec\(/, severity: "medium", advice: "usa execFile con allowlist y sin shell" },
  { rule: "http", pattern: /["'`]http:\/\//, severity: "low", advice: "usa https" },
  { rule: "hardcoded-secret", pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9._-]{12,}["']/i, severity: "high", advice: "no hardcodees secretos; usa variables de entorno" },
  { rule: "sql-concat", pattern: /(SELECT|INSERT|UPDATE|DELETE)[^;]*\+\s*\w+/i, severity: "high", advice: "usa consultas parametrizadas" },
];

export function addedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

export function reviewTextForRisks(text: string, onlyAdded = false): SecurityFinding[] {
  const lines = onlyAdded ? addedLines(text) : text.split(/\r?\n/);
  const findings: SecurityFinding[] = [];
  for (const line of lines) {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({ rule: rule.rule, line: line.trim().slice(0, 120), severity: rule.severity, advice: rule.advice });
      }
    }
  }
  return findings;
}

export function blocksOnSecurity(finding: SecurityFinding): boolean {
  return finding.severity === "high";
}
