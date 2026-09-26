export interface RoutingIntent {
  domain: string;
  type: string;
  effort: string;
  needs?: string[];
}

export interface RoutingRule {
  id: string;
  when: { domain?: string; type?: string; effort?: string };
  model: string;
}

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  { id: "engine-high", when: { domain: "engine", effort: "high" }, model: "deepseek-reasoner" },
  { id: "engine", when: { domain: "engine" }, model: "deepseek-chat" },
  { id: "docs", when: { type: "docs" }, model: "deepseek-chat" },
  { id: "qa", when: { type: "qa" }, model: "deepseek-chat" },
];

function ruleMatches(rule: RoutingRule, intent: RoutingIntent): boolean {
  return Object.entries(rule.when).every(([key, value]) => !value || intent[key as keyof RoutingIntent] === value);
}

export function selectModel(rules: RoutingRule[], intent: RoutingIntent, fallbackModel: string): string {
  const match = rules.find((rule) => ruleMatches(rule, intent));
  return match?.model || fallbackModel;
}

export function fallbackChain(primaryModel: string, fallbackModels: string[] = [], maxRetries = 2): string[] {
  const chain = [primaryModel, ...fallbackModels].map((model) => model.trim()).filter(Boolean);
  const unique = [...new Set(chain)];
  return unique.slice(0, Math.max(1, maxRetries + 1));
}

export function describeRoute(intent: RoutingIntent, rules: RoutingRule[], fallbackModel: string): { model: string; ruleId: string | null } {
  const match = rules.find((rule) => ruleMatches(rule, intent));
  return { model: match?.model ?? fallbackModel, ruleId: match?.id ?? null };
}
