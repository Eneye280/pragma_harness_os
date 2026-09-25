import { SECRET_PATTERNS } from "../tools/types";
import type { Gate, GateOutcome, PreGateContext } from "./types";

export interface SecretHit {
  patternIndex: number;
  match: string;
}

function findSecretHits(rawText: string): SecretHit[] {
  const hits: SecretHit[] = [];
  SECRET_PATTERNS.forEach((pattern, patternIndex) => {
    pattern.lastIndex = 0;
    const matches = rawText.match(pattern);
    if (matches) {
      for (const match of matches) hits.push({ patternIndex, match: match.slice(0, 6) + "…" });
    }
  });
  return hits;
}

export class SecretGate implements Gate {
  readonly name = "secret-gate" as const;

  check(context: PreGateContext): GateOutcome {
    const hits = findSecretHits(`${context.message}\n${context.normalized}`);
    if (hits.length === 0) {
      return { gate: this.name, verdict: "pass", reason: "no secret pattern detected" };
    }
    return {
      gate: this.name,
      verdict: "block",
      reason: "message contains what looks like a secret",
      detail: { hitCount: hits.length, patterns: hits.map((hit) => hit.patternIndex) },
    };
  }
}

export const secretGate = new SecretGate();
