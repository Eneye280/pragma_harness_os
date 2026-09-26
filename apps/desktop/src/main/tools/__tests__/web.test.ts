import { describe, expect, it } from "vitest";
import { isAllowedUrl, webFetch } from "../web";

describe("web fetch (docs allowlist)", () => {
  it("allows official docs over https and blocks everything else", () => {
    expect(isAllowedUrl("https://docs.unity3d.com/Manual/index.html")).toBe(true);
    expect(isAllowedUrl("https://developer.mozilla.org/en-US/docs/Web/API/URL")).toBe(true);
    expect(isAllowedUrl("http://docs.unity3d.com/")).toBe(false);
    expect(isAllowedUrl("https://evil.example.com/steal")).toBe(false);
    expect(isAllowedUrl("not a url")).toBe(false);
  });

  it("fetches and extracts title and text", async () => {
    const fetchImpl = (async () => new Response("<html><head><title>Docs</title></head><body><p>Hello <b>world</b></p></body></html>", { status: 200 })) as unknown as typeof fetch;
    const result = await webFetch("https://nodejs.org/docs", { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.title).toBe("Docs");
    expect(result.excerpt).toContain("Hello world");
  });

  it("returns a clear error for disallowed or failing urls", async () => {
    const blocked = await webFetch("https://evil.example.com/");
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/no permitido/);

    const failing = await webFetch("https://nodejs.org/docs", { fetchImpl: (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch });
    expect(failing.ok).toBe(false);
    expect(failing.error).toMatch(/500/);
  });
});
