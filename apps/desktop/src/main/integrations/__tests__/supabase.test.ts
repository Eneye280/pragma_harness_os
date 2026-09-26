import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl, testSupabase, type IntegrationFetch } from "../supabase";

const fetchStatus = (status: number): IntegrationFetch => async () => ({ ok: status >= 200 && status < 300, status });

describe("supabase integration", () => {
  it("normalizes the project url", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
  });

  it("requires url and anon key", async () => {
    expect((await testSupabase({ url: "", anonKey: "k" })).detail).toMatch(/URL/);
    expect((await testSupabase({ url: "https://x.supabase.co", anonKey: "" })).detail).toMatch(/anon key/);
  });

  it("sends the apikey header and reports availability", async () => {
    const seen: Array<Record<string, string> | undefined> = [];
    const fetchImpl: IntegrationFetch = async (_url, init) => {
      seen.push(init?.headers);
      return { ok: true, status: 200 };
    };
    const result = await testSupabase({ url: "https://x.supabase.co/", anonKey: "anon-123" }, fetchImpl);
    expect(result.ok).toBe(true);
    expect(seen[0]?.apikey).toBe("anon-123");
  });

  it("handles 401/404/offline without throwing", async () => {
    expect((await testSupabase({ url: "https://x.supabase.co", anonKey: "k" }, fetchStatus(401))).detail).toMatch(/401/);
    expect((await testSupabase({ url: "https://x.supabase.co", anonKey: "k" }, fetchStatus(404))).detail).toMatch(/404|no encontrado/);
    const offline = await testSupabase({ url: "https://x.supabase.co", anonKey: "k" }, async () => { throw new Error("dns"); });
    expect(offline.detail).toMatch(/sin conexión/);
  });
});
