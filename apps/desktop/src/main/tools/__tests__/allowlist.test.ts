import { describe, expect, it } from "vitest";
import { checkTerminalCommand } from "../allowlist";

describe("terminal allowlist", () => {
  it("allows read-only commands and allowlisted subcommands", () => {
    expect(checkTerminalCommand("git", ["status"]).allowed).toBe(true);
    expect(checkTerminalCommand("git", ["diff", "--stat"]).allowed).toBe(true);
    expect(checkTerminalCommand("pnpm", ["test"]).allowed).toBe(true);
    expect(checkTerminalCommand("ls", ["-la"]).allowed).toBe(true);
    expect(checkTerminalCommand("cat", ["README.md"]).allowed).toBe(true);
  });

  it("blocks destructive patterns", () => {
    expect(checkTerminalCommand("rm", ["-rf", "/"]).allowed).toBe(false);
    expect(checkTerminalCommand("git", ["push"]).allowed).toBe(false);
    expect(checkTerminalCommand("git", ["reset", "--hard"]).allowed).toBe(false);
    expect(checkTerminalCommand("echo", ["x", ">", "file"]).allowed).toBe(false);
    expect(checkTerminalCommand("pnpm", ["install"]).allowed).toBe(false);
    expect(checkTerminalCommand("shutdown", ["/s"]).allowed).toBe(false);
  });

  it("blocks commands outside the allowlist and unlisted subcommands", () => {
    expect(checkTerminalCommand("powershell", ["-c", "whoami"]).allowed).toBe(false);
    expect(checkTerminalCommand("git", ["commit"]).allowed).toBe(false);
    expect(checkTerminalCommand("").allowed).toBe(false);
  });
});
