import type { HarnessPlugin, PluginContext, PluginResult } from "../../src/main/harness/plugin-chain";

const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "openai/deepseek key", pattern: /sk-[A-Za-z0-9]{8,}/g },
  { label: "github token", pattern: /ghp_[A-Za-z0-9]{8,}/g },
  { label: "slack token", pattern: /xox[bpas]-[A-Za-z0-9-]{8,}/g },
  { label: "api_key assignment", pattern: /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi },
  { label: "password assignment", pattern: /password\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi },
];

export interface SecretHit {
  label: string;
  sample: string;
}

export function findSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const { label, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) hits.push({ label, sample: `${match.slice(0, 4)}…` });
    }
  }
  return hits;
}

export const secretScanPlugin: HarnessPlugin = {
  name: "secret-scan",
  version: "0.1.0",
  stage: "pre-agent",
  priority: 20,
  async hook(ctx: PluginContext): Promise<PluginResult> {
    const hits = findSecrets(`${ctx.message}\n${ctx.diff ?? ""}`);
    if (hits.length === 0) return { action: "pass" };
    const labels = [...new Set(hits.map((hit) => hit.label))].join(", ");
    return {
      action: "block",
      reason: `secret-scan: se detectaron posibles secretos (${labels}). Quítalos del mensaje/diff y usa variables de entorno.`,
    };
  },
};
