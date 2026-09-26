import { describe, expect, it } from "vitest";
import { compareVersions, fetchRelease, isNewer, parseManifest, type FetchLike } from "../feed";

function fetchReturning(status: number, body?: unknown): FetchLike {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("private release feed", () => {
  it("compares versions", () => {
    expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
    expect(isNewer("1.0.0", "1.0.1")).toBe(true);
    expect(isNewer("1.0.1", "1.0.0")).toBe(false);
  });

  it("detects an available version with a token", async () => {
    const seen: Array<Record<string, string> | undefined> = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      seen.push(init?.headers);
      return { ok: true, status: 200, json: async () => ({ releases: [{ version: "1.1.0", notes: "- fixes", channel: "stable" }] }) };
    };
    const result = await fetchRelease({ url: "https://feed.example/releases.json", token: "tok", channel: "stable" }, "1.0.1", fetchImpl);
    expect(result.available).toBe(true);
    expect(result.release?.version).toBe("1.1.0");
    expect(seen[0]?.Authorization).toBe("Bearer tok");
  });

  it("does not break on 401/403/404 or offline", async () => {
    const unauthorized = await fetchRelease({ url: "https://x", channel: "stable" }, "1.0.0", fetchReturning(401));
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.reason).toMatch(/401|token/i);

    const missing = await fetchRelease({ url: "https://x", channel: "stable" }, "1.0.0", fetchReturning(404));
    expect(missing.ok).toBe(false);
    expect(missing.reason).toMatch(/404/);

    const offline = await fetchRelease({ url: "https://x", channel: "stable" }, "1.0.0", async () => {
      throw new Error("dns");
    });
    expect(offline.ok).toBe(false);
    expect(offline.reason).toMatch(/offline/);
  });

  it("selects the release for the requested channel", () => {
    const manifest = {
      releases: [
        { version: "1.2.0", notes: "beta", channel: "beta" },
        { version: "1.1.0", notes: "stable", channel: "stable" },
      ],
    };
    expect(parseManifest(manifest, "stable")?.version).toBe("1.1.0");
    expect(parseManifest(manifest, "beta")?.version).toBe("1.2.0");
  });

  it("reports up to date without a release", async () => {
    const result = await fetchRelease({ url: "https://x", channel: "stable" }, "2.0.0", fetchReturning(200, { version: "1.0.0", notes: "old" }));
    expect(result.ok).toBe(true);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/al día/);
  });
});
