export type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

export type MarkdownBlock =
  | { type: "code"; lang: string; content: string }
  | { type: "tool"; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

export function tokenizeInline(rawText: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawText)) !== null) {
    if (match.index > cursor) tokens.push({ type: "text", value: rawText.slice(cursor, match.index) });
    const tokenText = match[0];
    if (tokenText.startsWith("`")) tokens.push({ type: "code", value: tokenText.slice(1, -1) });
    else if (tokenText.startsWith("**")) tokens.push({ type: "bold", value: tokenText.slice(2, -2) });
    else tokens.push({ type: "italic", value: tokenText.slice(1, -1) });
    cursor = match.index + tokenText.length;
  }

  if (cursor < rawText.length) tokens.push({ type: "text", value: rawText.slice(cursor) });
  return tokens;
}

export function parseMarkdown(rawText: string): MarkdownBlock[] {
  const lines = rawText.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index++;
      }
      index++;
      const content = codeLines.join("\n");
      blocks.push(lang === "tool" ? { type: "tool", content } : { type: "code", lang, content });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      index++;
      continue;
    }

    const listMatch = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const itemMatch = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[listIndex]);
        if (!itemMatch) break;
        items.push(itemMatch[2].trim());
        listIndex++;
      }
      blocks.push({ type: "list", ordered, items });
      index = listIndex;
      continue;
    }

    if (line.trim() === "") {
      index++;
      continue;
    }

    const paragraphLines: string[] = [];
    let paragraphIndex = index;
    while (paragraphIndex < lines.length) {
      const candidate = lines[paragraphIndex];
      if (candidate.trim() === "" || candidate.trim().startsWith("```") || /^(#{1,6})\s+/.test(candidate) || /^\s*([-*]|\d+\.)\s+/.test(candidate)) {
        break;
      }
      paragraphLines.push(candidate);
      paragraphIndex++;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    index = paragraphIndex;
  }

  return blocks;
}

export function stripToolBlocks(rawText: string): string {
  return rawText.replace(/```tool[\s\S]*?```/g, "").trim();
}
