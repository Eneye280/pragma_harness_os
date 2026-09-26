import { describe, expect, it } from "vitest";
import { DEFAULT_STUCK_TIMEOUT_MS, diagnoseStuck, recoveryAction, StuckMonitor } from "../stuck";

describe("stuck task guardrail", () => {
  it("detects no progress after the timeout", () => {
    const monitor = new StuckMonitor(600_000, 1_000_000);
    expect(monitor.isStuck(1_000_000)).toBe(false);
    expect(monitor.isStuck(1_599_999)).toBe(false);
    expect(monitor.isStuck(1_600_000)).toBe(true);
    expect(monitor.report(1_600_000).advice).toMatch(/Sin progreso > 10 min/);
  });

  it("resets when there is progress", () => {
    const monitor = new StuckMonitor(600_000, 0);
    monitor.note(500_000);
    expect(monitor.isStuck(1_050_000)).toBe(false);
    expect(monitor.idleMs(1_050_000)).toBe(550_000);
  });

  it("recommends refresh then abort", () => {
    const timeout = DEFAULT_STUCK_TIMEOUT_MS;
    expect(recoveryAction(timeout - 1, timeout)).toBeNull();
    expect(recoveryAction(timeout + 1, timeout)).toBe("refresh-context");
    expect(recoveryAction(timeout * 2 + 1, timeout)).toBe("abort");
  });

  it("diagnoses the likely cause", () => {
    expect(diagnoseStuck({ lastEvent: "agent", retries: 0, externalWait: false })).toMatch(/refresca contexto/);
    expect(diagnoseStuck({ lastEvent: "agent", retries: 0, externalWait: true })).toMatch(/espera externa/);
    expect(diagnoseStuck({ lastEvent: "agent", retries: 4, externalWait: false })).toMatch(/bucle/);
    expect(diagnoseStuck({ lastEvent: "agent", retries: 0, externalWait: false, errorMessage: "boom" })).toMatch(/error real/);
  });
});
