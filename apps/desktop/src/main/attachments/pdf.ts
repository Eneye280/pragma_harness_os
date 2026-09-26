import { inflateSync } from "zlib";

function unescapePdfString(value: string): string {
  return value.replace(/\\([()\\])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ");
}

function extractOperators(content: string): string {
  const parts: string[] = [];
  for (const match of content.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)) parts.push(unescapePdfString(match[1]));
  for (const match of content.matchAll(/\[((?:[^[\]]|\\.)*)\]\s*TJ/g)) {
    const inner = [...match[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map((entry) => unescapePdfString(entry[1])).join("");
    if (inner) parts.push(inner);
  }
  return parts.join(" ");
}

export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streams: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = match[1];
    try {
      streams.push(inflateSync(Buffer.from(body, "latin1")).toString("latin1"));
    } catch {
      streams.push(body);
    }
  }
  const text = streams
    .map(extractOperators)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return text;
}
