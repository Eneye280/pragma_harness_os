import { describe, expect, it } from "vitest";
import { resolveExecutable } from "../terminal";

describe("terminal executable resolution", () => {
  it("maps Windows package-manager shims to .cmd", () => {
    if (process.platform === "win32") {
      expect(resolveExecutable("pnpm")).toBe("pnpm.cmd");
      expect(resolveExecutable("npm")).toBe("npm.cmd");
      expect(resolveExecutable("npx")).toBe("npx.cmd");
    } else {
      expect(resolveExecutable("pnpm")).toBe("pnpm");
    }
  });

  it("leaves real executables and already-suffixed shims untouched", () => {
    expect(resolveExecutable("node")).toBe("node");
    expect(resolveExecutable("git")).toBe("git");
    if (process.platform === "win32") expect(resolveExecutable("pnpm.cmd")).toBe("pnpm.cmd");
  });
});
