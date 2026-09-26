import { describe, expect, it } from "vitest";
import { codeBlockLabel, diffTone, isDiffLanguage, sanitizeLang, TOKEN_CLASS } from "../code-block";
import { tokenizeCode } from "../../explorer/code-tokens";

describe("chat code blocks", () => {
  it("sanitizes the language and labels the block", () => {
    expect(sanitizeLang("TS")).toBe("ts");
    expect(sanitizeLang("unknown-lang")).toBe("unknown-lang");
    expect(sanitizeLang("")).toBe("text");
    expect(codeBlockLabel("tsx")).toBe("TSX");
  });

  it("classifies diff lines", () => {
    expect(isDiffLanguage("diff")).toBe(true);
    expect(diffTone("+ const a = 1;", "diff")).toBe("add");
    expect(diffTone("- const a = 1;", "diff")).toBe("remove");
    expect(diffTone("@@ -1,2 +1,2 @@", "diff")).toBe("meta");
    expect(diffTone("+ added", "ts")).toBe("none");
  });

  it("tokenizes an ecosystem language into colorable tokens", () => {
    const lines = tokenizeCode('const total = 42; // suma\nconsole.log("hola");', "ts");
    const kinds = lines.flat().map((token) => token.kind);
    expect(kinds).toContain("keyword");
    expect(kinds).toContain("number");
    expect(kinds).toContain("string");
    expect(kinds).toContain("comment");
    for (const token of lines.flat()) expect(TOKEN_CLASS[token.kind]).toBeTruthy();
  });
});
