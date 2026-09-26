export interface AllowlistResult {
  allowed: boolean;
  reason?: string;
}

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, reason: "recursive force delete" },
  { pattern: /Remove-Item\b.*-Recurse/i, reason: "recursive delete" },
  { pattern: /\bdel\s+\/[sfq]/i, reason: "forced delete" },
  { pattern: /\b(format|diskpart|fdisk|mkfs)\b/i, reason: "disk formatting" },
  { pattern: /\bshutdown|\breboot\b/i, reason: "system shutdown" },
  { pattern: /git\s+push/i, reason: "git push is not allowed for the agent" },
  { pattern: /git\s+reset\s+--hard/i, reason: "hard reset discards work" },
  { pattern: /git\s+clean/i, reason: "git clean deletes untracked files" },
  { pattern: /git\s+checkout\s+--\s/i, reason: "discards local changes" },
  { pattern: /(^|\s)>\s*\S/, reason: "shell output redirection" },
  { pattern: /\|\s*(sh|bash|zsh|cmd|powershell|pwsh)\b/i, reason: "piping into a shell" },
  { pattern: /\b(curl|wget)\b[^|]*\|/i, reason: "piping a download into a command" },
  { pattern: /\bchmod\s+777\b/i, reason: "permissive chmod" },
  { pattern: /\bnpm\s+(install|i|publish)\b/i, reason: "install/publish requires explicit user action" },
  { pattern: /\bpnpm\s+(install|i|add|publish)\b/i, reason: "install/publish requires explicit user action" },
];

const ALLOWED_COMMANDS: Record<string, RegExp | true> = {
  git: /^(status|diff|log|show|branch|rev-parse|ls-files|grep|blame|remote|config|shortlog)$/i,
  pnpm: /^(test|build|lint|typecheck|list|ls|run|outdated|audit|why)$/i,
  npm: /^(test|run|ls|list|view|outdated|audit)$/i,
  node: true,
  npx: true,
  ls: true,
  dir: true,
  cat: true,
  type: true,
  pwd: true,
  echo: true,
  where: true,
  tree: true,
  rg: true,
  findstr: true,
  find: true,
  head: true,
  tail: true,
  wc: true,
};

export function checkTerminalCommand(command: string, args: string[] = []): AllowlistResult {
  const full = [command, ...args].join(" ").trim();
  if (!command.trim()) return { allowed: false, reason: "empty command" };
  for (const { pattern, reason } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(full)) return { allowed: false, reason };
  }
  const rule = ALLOWED_COMMANDS[command.toLowerCase()];
  if (rule === undefined) return { allowed: false, reason: `command not in allowlist: ${command}` };
  if (rule === true) return { allowed: true };
  const subcommand = args.find((arg) => !arg.startsWith("-")) ?? "";
  if (!rule.test(subcommand)) return { allowed: false, reason: `${command} ${subcommand} is not allowlisted` };
  return { allowed: true };
}
