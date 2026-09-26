import { describe, expect, it } from "vitest";
import { profileFor, suggestCases } from "../qa-profiles";

describe("QA stack profiles", () => {
  it("exposes a unity profile with the expected checks", () => {
    const profile = profileFor("Unity");
    expect(profile?.checks.map((check) => check.id)).toEqual(["uxml", "ugui", "play", "movement"]);
    for (const check of profile!.checks) {
      expect(check.docs).toMatch(/^https:\/\/docs\.unity3d\.com\//);
      expect(check.case.length).toBeGreaterThan(20);
    }
  });

  it("suggests cases for changed unity files and cites docs", () => {
    const suggestions = suggestCases("unity", ["Assets/Scripts/PlayerController.cs", "Assets/UI/Hud.uxml"]);
    const ids = suggestions.map((suggestion) => suggestion.check.id);
    expect(ids).toContain("uxml");
    expect(ids).toContain("movement");
    expect(suggestions.every((suggestion) => suggestion.check.docs.startsWith("https://docs.unity3d.com/"))).toBe(true);
  });

  it("returns everything when there are no changed files, and nothing for unknown stacks", () => {
    expect(suggestCases("unity", [])).toHaveLength(4);
    expect(suggestCases("cobol", ["a.cob"])).toHaveLength(0);
    expect(profileFor("nope")).toBeNull();
  });
});
