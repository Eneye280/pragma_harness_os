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

describe("AgentCatalog hot-reload", () => {
  it("loads user agents from the project and reloads them", async () => {
    const { mkdirSync, writeFileSync, rmSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const { randomUUID } = await import("crypto");
    const workspace = join(tmpdir(), `phs67-${randomUUID().slice(0, 8)}`);
    mkdirSync(join(workspace, ".pragma-harness", "agents"), { recursive: true });

    const catalog = new AgentCatalog();
    catalog.useRoots(() => [workspace]);
    expect(catalog.get("custom-agent")).toBeNull();

    writeFileSync(
      join(workspace, ".pragma-harness", "agents", "custom-agent.json"),
      JSON.stringify({ id: "custom-agent", name: "Custom", role: "r", domains: ["web"], skills: [], prompt: "p" }),
      "utf8"
    );
    catalog.reload();
    expect(catalog.get("custom-agent")?.name).toBe("Custom");
    expect(catalog.list().some((agent) => agent.id === "custom-agent")).toBe(true);

    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  });

  it("ignores malformed agent json without breaking the catalog", async () => {
    const { mkdirSync, writeFileSync, rmSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const { randomUUID } = await import("crypto");
    const workspace = join(tmpdir(), `phs67b-${randomUUID().slice(0, 8)}`);
    mkdirSync(join(workspace, ".pragma-harness", "agents"), { recursive: true });
    writeFileSync(join(workspace, ".pragma-harness", "agents", "broken.json"), "{not json", "utf8");

    const catalog = new AgentCatalog();
    catalog.useRoots(() => [workspace]);
    expect(catalog.list()).toHaveLength(10);

    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  });
});
