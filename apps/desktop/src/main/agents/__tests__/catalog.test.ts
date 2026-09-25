import { describe, it, expect } from "vitest";
import { AgentCatalog } from "../catalog";

describe("AgentCatalog", () => {
  it("exposes the 10 seed agents", () => {
    const catalog = new AgentCatalog();
    expect(catalog.list()).toHaveLength(10);
  });

  it("marks the active agent", () => {
    const catalog = new AgentCatalog();
    const active = catalog.list("backend-api").find((agent) => agent.active);
    expect(active?.id).toBe("backend-api");
  });

  it("returns null for an unknown id", () => {
    expect(new AgentCatalog().get("does-not-exist")).toBeNull();
  });

  it("selects the agent matching the domain", () => {
    const catalog = new AgentCatalog();
    expect(catalog.selectFor("backend").agent.id).toBe("backend-api");
    expect(catalog.selectFor("engine").agent.id).toBe("engine-vulkan");
    expect(catalog.selectFor("unity").agent.id).toBe("unity-gameplay");
  });

  it("falls back to the general builder for an unknown domain", () => {
    const selection = new AgentCatalog().selectFor("quantum");
    expect(selection.agent.id).toBe("general-builder");
    expect(selection.matched).toBe(false);
  });

  it("honours an explicit preferred agent", () => {
    const catalog = new AgentCatalog();
    const preferred = catalog.selectFor("unity", "unity-ui");
    expect(preferred.agent.id).toBe("unity-ui");
    expect(preferred.matched).toBe(true);

    const ignored = catalog.selectFor("unity", "does-not-exist");
    expect(ignored.agent.id).toBe("unity-gameplay");
  });
});
