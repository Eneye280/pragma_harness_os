export interface DomainMetrics {
  domain: string;
  tokens: number;
  usd: number;
  calls: number;
}

export interface CostTotals {
  tokens: number;
  usd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostSnapshot {
  today: CostTotals;
  total: { tokens: number; usd: number; calls: number };
  budget: { tokensPerDay: number; usdPerDay: number };
  perDomain: DomainMetrics[];
  updatedAt: number;
}

export interface UsageRecord {
  domain: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ts?: number;
}
