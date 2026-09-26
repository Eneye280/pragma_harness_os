export interface RagDocument {
  path: string;
  chars: number;
}

export interface RagStats {
  size: number;
  excludes: string[];
  documents: RagDocument[];
}

export interface RagRecallHit {
  path: string;
  score: number;
  snippet: string;
}

export interface RagReindexResult {
  mode: "full" | "incremental";
  indexed: number;
  size: number;
}

export interface RagProgressEvent {
  processed: number;
  total: number;
  path?: string;
  done: boolean;
}
