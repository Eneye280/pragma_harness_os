import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CORE_RULES, STYLE_RULES, DOMAIN_RULES } from "./rules/core-rules";

export interface RuleCompileOptions {
  maxTokens?: number;
  includeAgentsMd?: boolean;
}

function truncateByTokens(text: string, maxTokens: number): string {
  const approxTokens = Math.ceil(text.length / 4);
  if (approxTokens <= maxTokens) return text;
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + "\n…[truncated by token budget]";
}

export class RuleEngine {
  compile(intent: { domain: string }, opts: RuleCompileOptions = {}): string {
    const maxTokens = opts.maxTokens ?? 1200;
    const domain = intent.domain as keyof typeof DOMAIN_RULES;
    const domainRule = DOMAIN_RULES[domain] ?? DOMAIN_RULES["general"];

    const coreBlock = Object.entries(CORE_RULES)
      .map(([k, v]) => `- [${k}] ${v}`)
      .join("\n");

    const styleBlock = Object.entries(STYLE_RULES)
      .map(([k, v]) => `- [${k}] ${v}`)
      .join("\n");

    let agentsBlock = "";
    if (opts.includeAgentsMd !== false) {
      const candidates = [join(process.cwd(), "AGENTS.md"), join(process.cwd(), ".opencode", "AGENTS.md")];
      for (const p of candidates) {
        if (existsSync(p)) {
          try {
            const content = readFileSync(p, "utf-8").slice(0, 2000);
            agentsBlock = `\n\n# AGENTS.md (${p})\n${content}`;
            break;
          } catch {}
        }
      }
    }

    const raw = `# HARNESS RULES (always injected, not optional)

## Core G1-G10
${coreBlock}

## Style
${styleBlock}

## Domain [${domain}]
- ${domainRule}${agentsBlock}`;

    return truncateByTokens(raw, maxTokens);
  }

  getCoreRules(): Record<string, string> {
    return { ...CORE_RULES };
  }

  getStyleRules(): Record<string, string> {
    return { ...STYLE_RULES };
  }

  getDomainRule(domain: string): string {
    return DOMAIN_RULES[domain as keyof typeof DOMAIN_RULES] ?? DOMAIN_RULES["general"];
  }
}

export const ruleEngine = new RuleEngine();
