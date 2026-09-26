import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTING_RULES, describeRoute, fallbackChain, selectModel } from "../routing";

describe("model routing", () => {
  it("picks the model for the intent", () => {
    expect(selectModel(DEFAULT_ROUTING_RULES, { domain: "engine", type: "feature", effort: "high" }, "default")).toBe("deepseek-reasoner");
    expect(selectModel(DEFAULT_ROUTING_RULES, { domain: "engine", type: "feature", effort: "low" }, "default")).toBe("deepseek-chat");
    expect(selectModel(DEFAULT_ROUTING_RULES, { domain: "backend", type: "docs", effort: "low" }, "default")).toBe("deepseek-chat");
  });

  it("falls back to the default model when no rule matches", () => {
    expect(selectModel(DEFAULT_ROUTING_RULES, { domain: "unity", type: "feature", effort: "medium" }, "deepseek-chat")).toBe("deepseek-chat");
    expect(describeRoute({ domain: "unity", type: "feature", effort: "medium" }, DEFAULT_ROUTING_RULES, "deepseek-chat")).toEqual({ model: "deepseek-chat", ruleId: null });
  });

  it("builds a deduplicated fallback chain capped by retries", () => {
    expect(fallbackChain("primary", ["secondary", "primary", "tertiary"], 2)).toEqual(["primary", "secondary", "tertiary"]);
    expect(fallbackChain("primary", ["secondary", "tertiary"], 1)).toEqual(["primary", "secondary"]);
    expect(fallbackChain("primary", [], 2)).toEqual(["primary"]);
  });
});
