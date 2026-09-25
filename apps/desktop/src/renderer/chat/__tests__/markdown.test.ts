import { describe, it, expect } from "vitest";
import { parseMarkdown, stripToolBlocks, tokenizeInline } from "../markdown";

describe("Markdown parsing", () => {
  it("parses a fenced code block with language", () => {
    const blocks = parseMarkdown("texto\n\n```ts\nconst a = 1;\n```");
    expect(blocks).toContainEqual({ type: "paragraph", text: "texto" });
    expect(blocks).toContainEqual({ type: "code", lang: "ts", content: "const a = 1;" });
  });

  it("separates tool blocks from visible code", () => {
    const blocks = parseMarkdown('```tool\n{"tool":"fileEdit"}\n```');
    expect(blocks).toEqual([{ type: "tool", content: '{"tool":"fileEdit"}' }]);
    expect(stripToolBlocks('antes\n```tool\n{"x":1}\n```\ndespues')).toBe("antes\n\ndespues");
  });

  it("parses headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("# Titulo\n\nparrafo uno\nparrafo dos\n\n- a\n- b\n\n1. uno\n2. dos");
    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "Titulo" });
    expect(blocks.find((block) => block.type === "paragraph")).toEqual({ type: "paragraph", text: "parrafo uno\nparrafo dos" });
    expect(blocks).toContainEqual({ type: "list", ordered: false, items: ["a", "b"] });
    expect(blocks).toContainEqual({ type: "list", ordered: true, items: ["uno", "dos"] });
  });

  it("tokenizes inline code, bold and italic", () => {
    expect(tokenizeInline("usa `code` y **fuerte** y *suave*")).toEqual([
      { type: "text", value: "usa " },
      { type: "code", value: "code" },
      { type: "text", value: " y " },
      { type: "bold", value: "fuerte" },
      { type: "text", value: " y " },
      { type: "italic", value: "suave" },
    ]);
  });

  it("keeps plain text as a single token", () => {
    expect(tokenizeInline("sin formato")).toEqual([{ type: "text", value: "sin formato" }]);
  });
});
