import { describe, expect, it } from "vitest";
import { assessAll, assessLicense, buildThirdPartyMarkdown, hasBlockingLicense } from "../licenses";

describe("license guard", () => {
  it("accepts permissive licenses and requires attribution", () => {
    expect(assessLicense("zod", "MIT").risk).toBe("ok");
    expect(assessLicense("fastify", "Apache-2.0").risk).toBe("ok");
  });

  it("warns on weak copyleft and unknown", () => {
    expect(assessLicense("x", "LGPL-3.0").risk).toBe("warn");
    expect(assessLicense("y", "unknown").risk).toBe("warn");
  });

  it("blocks strong copyleft for a permissive project", () => {
    const gpl = assessLicense("gpl-lib", "GPL-3.0", "MIT");
    expect(gpl.risk).toBe("block");
    expect(gpl.reason).toMatch(/incompatible/);
    expect(hasBlockingLicense([gpl])).toBe(true);
    expect(assessLicense("agpl-lib", "AGPL-3.0", "Apache-2.0").risk).toBe("block");
  });

  it("builds a third-party notices table", () => {
    const markdown = buildThirdPartyMarkdown([
      { name: "zod", version: "3.24.1", license: "MIT", url: "https://zod.dev" },
      { name: "ai", version: "4.0.0", license: "Apache-2.0" },
    ]);
    expect(markdown).toContain("# Third-party notices");
    expect(markdown).toContain("| ai | 4.0.0 | Apache-2.0 | - |");
    expect(assessAll([{ name: "zod", license: "MIT" }])).toHaveLength(1);
  });
});
