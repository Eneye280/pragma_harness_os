import { describe, it, expect } from "vitest";
import { RagIndex } from "../rag/index";

describe("RagIndex — local deterministic recall", () => {
  it("recalls by keyword and scores", async () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [] });
    rag.addDocument("skills/auth/SKILL.md", "auth with supabase and zod validation for backend");
    rag.addDocument("skills/vulkan/SKILL.md", "vulkan render pipeline with shaders and GPU");
    rag.addDocument("docs/handbook.md", "handbook about auth flow and oauth");

    const hits = rag.recall("auth", 5);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits.some((h) => h.path.includes("auth"))).toBe(true);
  });

  it("returns topK limited and sorted by score", () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [] });
    for (let i = 0; i < 10; i++) rag.addDocument(`doc${i}.md`, i < 3 ? "auth token" : "unrelated content");
    const hits = rag.recall("auth", 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });

  it("snippet contains query vicinity", () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [] });
    rag.addDocument("a.md", "lorem ipsum auth is here and we talk about oauth flow in detail");
    const hits = rag.recall("auth", 1);
    expect(hits[0].snippet.toLowerCase()).toContain("auth");
  });

  it("empty query returns no hits", () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [] });
    rag.addDocument("a.md", "some content");
    expect(rag.recall("", 5)).toHaveLength(0);
    expect(rag.recall("   ", 5)).toHaveLength(0);
  });

  it("indexes from filesystem when patterns match", async () => {
    const rag = new RagIndex({ patterns: ["skills/**/SKILL.md"] });
    const count = await rag.index();
    expect(count).toBeGreaterThan(0);
    const hits = rag.recall("tdd", 5);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("excludes change the indexed set and the hits", () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [] });
    rag.addDocument("skills/auth/SKILL.md", "auth with supabase");
    rag.addDocument("skills/security/SKILL.md", "auth security review");
    const before = rag.recall("auth", 5).length;

    rag.setExcludes(["skills/auth/**"]);
    expect(rag.getExcludes()).toEqual(["skills/auth/**"]);
    const after = rag.recall("auth", 5);

    expect(after.length).toBeLessThan(before);
    expect(after.every((hit) => !hit.path.startsWith("skills/auth/"))).toBe(true);
  });

  it("ignores excluded documents added after the fact", () => {
    const rag = new RagIndex({ root: "/tmp", patterns: [], excludes: ["*.tmp"] });
    rag.addDocument("draft.tmp", "auth draft");
    rag.addDocument("real.md", "auth real");
    expect(rag.size).toBe(1);
    expect(rag.listDocuments().map((doc) => doc.path)).toEqual(["real.md"]);
  });

  it("reports progress while indexing and supports incremental reindex", async () => {
    const rag = new RagIndex({ patterns: ["skills/**/SKILL.md"] });
    const progress: number[] = [];
    await rag.index((event) => progress.push(event.processed));
    expect(progress.length).toBeGreaterThan(0);
    const size = await rag.reindex("incremental");
    expect(size).toBe(rag.size);
  });
});
