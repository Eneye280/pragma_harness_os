export interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICES: Array<{ match: RegExp; price: ModelPrice }> = [
  { match: /deepseek-chat|deepseek-flash|deepseek/i, price: { inputPerMillion: 0.27, outputPerMillion: 1.1 } },
  { match: /claude-3-5-sonnet|claude-3\.5-sonnet|sonnet/i, price: { inputPerMillion: 3.0, outputPerMillion: 15.0 } },
  { match: /claude-3-5-haiku|haiku/i, price: { inputPerMillion: 0.8, outputPerMillion: 4.0 } },
  { match: /gpt-4o-mini/i, price: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { match: /gpt-4o/i, price: { inputPerMillion: 2.5, outputPerMillion: 10.0 } },
];

const PROVIDER_DEFAULTS: Record<string, ModelPrice> = {
  deepseek: { inputPerMillion: 0.27, outputPerMillion: 1.1 },
  anthropic: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  openai: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  ollama: { inputPerMillion: 0, outputPerMillion: 0 },
  mock: { inputPerMillion: 0, outputPerMillion: 0 },
};

export function priceFor(provider: string, model: string): ModelPrice {
  for (const entry of MODEL_PRICES) {
    if (entry.match.test(model)) return entry.price;
  }
  return PROVIDER_DEFAULTS[provider] ?? { inputPerMillion: 0, outputPerMillion: 0 };
}

export function estimateCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(provider, model);
  const inputCost = (inputTokens / 1_000_000) * price.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * price.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
