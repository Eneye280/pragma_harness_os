import { describe, expect, it, vi } from "vitest";
import { buildCommands, COMMAND_GROUP_LABEL, filterCommands, type CommandDeps } from "../commands";

function deps(): CommandDeps {
  const noop = vi.fn();
  return {
    onNewSession: noop,
    onOpenFolder: noop,
    onOpenSessions: noop,
    onToggleExplorer: noop,
    onToggleContext: noop,
    onToggleTerminal: noop,
    onOpenSettings: noop,
    onOpenUsage: noop,
    onOpenGraph: noop,
    onOpenDiagnostics: noop,
    onOpenHelp: noop,
    onOpenNotifications: noop,
    onTheme: noop,
  };
}

describe("command registry", () => {
  it("builds unique ids with a label and a known group", () => {
    const commands = buildCommands(deps());
    expect(commands.length).toBeGreaterThanOrEqual(12);
    const ids = commands.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const command of commands) {
      expect(COMMAND_GROUP_LABEL[command.group]).toBeTruthy();
      expect(command.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("invokes the wired callback", () => {
    const d = deps();
    const command = buildCommands(d).find((entry) => entry.id === "new-session");
    command?.run();
    expect(d.onNewSession).toHaveBeenCalledTimes(1);
  });

  it("filters by label and keywords, ranking word starts first", () => {
    const commands = buildCommands(deps());
    expect(filterCommands(commands, "sesion").map((entry) => entry.id)).toContain("new-session");
    expect(filterCommands(commands, "oscuro")[0].id).toBe("theme-dark");
    expect(filterCommands(commands, "zzzz")).toHaveLength(0);
    expect(filterCommands(commands, "")).toHaveLength(commands.length);
  });
});
