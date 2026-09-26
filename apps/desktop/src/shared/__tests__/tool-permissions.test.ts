import { describe, expect, it } from "vitest";
import { effectiveToolPermission, TOOL_PERMISSION_PRESETS } from "../settings";

describe("tool permissions", () => {
  it("allows everything when askBeforeTools is off", () => {
    const settings = { askBeforeTools: false, perTool: {} };
    expect(effectiveToolPermission("fileEdit", settings)).toBe("allow");
    expect(effectiveToolPermission("terminal", settings)).toBe("allow");
  });

  it("asks for mutating tools and allows reads when askBeforeTools is on", () => {
    const settings = { askBeforeTools: true, perTool: {} };
    expect(effectiveToolPermission("fileRead", settings)).toBe("allow");
    expect(effectiveToolPermission("fileEdit", settings)).toBe("ask");
    expect(effectiveToolPermission("terminal", settings)).toBe("ask");
    expect(effectiveToolPermission("mcp_call", settings)).toBe("ask");
  });

  it("lets an explicit per-tool policy win over the global toggle", () => {
    const settings = { askBeforeTools: false, perTool: { terminal: "deny" as const } };
    expect(effectiveToolPermission("terminal", settings)).toBe("deny");
    expect(effectiveToolPermission("fileEdit", settings)).toBe("allow");
  });

  it("exposes seguro and autonomo presets", () => {
    expect(effectiveToolPermission("terminal", TOOL_PERMISSION_PRESETS.seguro)).toBe("ask");
    expect(effectiveToolPermission("terminal", TOOL_PERMISSION_PRESETS.autonomo)).toBe("allow");
  });
});
