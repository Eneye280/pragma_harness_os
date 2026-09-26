import { describe, expect, it } from "vitest";
import { blocksOnSecurity, reviewTextForRisks } from "../security-review";

describe("security review", () => {
  it("finds high severity patterns in the diff", () => {
    const diff = ['+ const run = eval("2+2")', "+ el.innerHTML = userInput", "+ const apiKey = \"abcdef1234567890\""].join("\n");
    const findings = reviewTextForRisks(diff, true);
    expect(findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining(["eval", "innerHTML", "hardcoded-secret"]));
    expect(findings.filter(blocksOnSecurity).length).toBeGreaterThanOrEqual(2);
  });

  it("ignores removed lines when onlyAdded is set", () => {
    const findings = reviewTextForRisks('- const x = eval("x")', true);
    expect(findings).toHaveLength(0);
  });

  it("flags http and child_process as lower severity", () => {
    const findings = reviewTextForRisks('const url = "http://x.dev"; exec("ls")');
    expect(findings.some((finding) => finding.rule === "http" && !blocksOnSecurity(finding))).toBe(true);
    expect(findings.some((finding) => finding.rule === "child_process")).toBe(true);
  });

  it("returns no findings for safe code", () => {
    expect(reviewTextForRisks("const sum = (a: number, b: number) => a + b;")).toHaveLength(0);
  });
});
