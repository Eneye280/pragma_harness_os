export type DreamCandidateKind = "correction" | "error" | "workflow";

export interface DreamCandidate {
  kind: DreamCandidateKind;
  trigger: string;
  content: string;
  domain: string;
  count: number;
  evidence: string[];
}

export interface DreamNotification {
  kind: DreamCandidateKind;
  trigger: string;
  content: string;
  confidence: number;
  workspaceHash: string;
  ts: number;
}

export const CORRECTION_PATTERN = /\b(no,|no |en realidad|corrige|corregir|mal|incorrecto|equivocado|mejor usa|prefiero)\b/i;

export function extractCorrectionTrigger(message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
    .slice(0, 6)
    .join("-");
  return normalized.length > 0 ? normalized : "correccion-general";
}

const STOPWORDS = new Set(["no", "en", "realidad", "el", "la", "los", "las", "un", "una", "de", "del", "que", "y", "es", "usa", "usar", "por", "para", "con"]);
