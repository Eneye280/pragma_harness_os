import { describe, it, expect } from "vitest";
import { tokenizeCode, tokenizeLine } from "../code-tokens";

describe("Code tokenizer", () => {
  it("splits a ts line into keyword, string, number and plain tokens", () => {
    const tokens = tokenizeLine('const name = "harness"; return 42;', "typescript");
    const kinds = tokens.map((token) => token.kind);
    expect(kinds).toContain("keyword");
    expect(kinds).toContain("string");
    expect(kinds).toContain("number");
  });

  it("treats a // line as a whole comment", () => {
    expect(tokenizeLine("// nota del agente", "typescript")).toEqual([{ text: "// nota del agente", kind: "comment" }]);
  });

  it("treats # as a comment only for hash languages", () => {
    expect(tokenizeLine("# clave: valor", "yaml")).toEqual([{ text: "# clave: valor", kind: "comment" }]);
    expect(tokenizeLine("# privateField", "typescript").some((token) => token.kind === "comment")).toBe(false);
  });

  it("keeps plain text for unknown languages", () => {
    const tokens = tokenizeLine("hola mundo", "plaintext");
    expect(tokens.every((token) => token.kind === "plain")).toBe(true);
    expect(tokens.map((token) => token.text).join("")).toBe("hola mundo");
  });

  it("returns one token array per line", () => {
    const lines = tokenizeCode("const a = 1;\nconst b = 2;", "typescript");
    expect(lines).toHaveLength(2);
  });

  it("highlights html tags and attributes", () => {
    const kinds = tokenizeLine('<button class="btn" data-op="add">+</button>', "html").map((token) => token.kind);
    expect(kinds).toContain("tag");
    expect(kinds).toContain("attr");
    expect(kinds).toContain("string");
  });

  it("highlights css properties, values and at-rules", () => {
    const kinds = tokenizeLine("display: flex; color: #fff;", "css").map((token) => token.kind);
    expect(kinds).toContain("property");
    expect(kinds).toContain("keyword");
  });

  it("highlights json keys and literals", () => {
    const kinds = tokenizeLine('{ "name": "calc", "ok": true, "n": 3 }', "json").map((token) => token.kind);
    expect(kinds).toContain("property");
    expect(kinds).toContain("literal");
    expect(kinds).toContain("number");
  });

  it("highlights different languages differently", () => {
    const cs = tokenizeLine("public void Update() { }", "cs").map((token) => token.kind);
    expect(cs).toContain("keyword");
    const lua = tokenizeLine("-- comentario", "lua");
    expect(lua).toEqual([{ text: "-- comentario", kind: "comment" }]);
    const sql = tokenizeLine("SELECT id FROM users;", "sql").map((token) => token.kind);
    expect(sql).toContain("keyword");
  });
});
