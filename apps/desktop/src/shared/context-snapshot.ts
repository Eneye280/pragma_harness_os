export interface RagSnippet {
  path: string;
  score: number;
  snippet: string;
}

export interface InstinctSummary {
  trigger: string;
  content: string;
  confidence: number;
}

export interface HarnessContextSnapshot {
  sessionId: string;
  skills: { names: string[]; sources: string[]; tokens: number };
  rules: { domain: string; label: string; tokens: number };
  rag: { hits: RagSnippet[]; tokens: number; indexSize: number };
  files: { paths: string[]; tokens: number };
  instincts: { items: InstinctSummary[]; tokens: number };
  agent?: { id: string; name: string } | null;
  tokens: { used: number; limit: number };
  model: string;
  createdAt: number;
}
