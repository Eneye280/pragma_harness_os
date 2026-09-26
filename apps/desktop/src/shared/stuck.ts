export const DEFAULT_STUCK_TIMEOUT_MS = 10 * 60 * 1000;

export interface StuckReport {
  stuck: boolean;
  idleMs: number;
  timeoutMs: number;
  advice: string;
}

export type RecoveryAction = "refresh-context" | "abort";

export class StuckMonitor {
  private lastProgressAt: number;

  constructor(timeoutMs: number = DEFAULT_STUCK_TIMEOUT_MS, now: number = Date.now()) {
    this.timeoutMs = timeoutMs;
    this.lastProgressAt = now;
  }

  private readonly timeoutMs: number;

  note(now: number = Date.now()): void {
    this.lastProgressAt = now;
  }

  idleMs(now: number = Date.now()): number {
    return Math.max(0, now - this.lastProgressAt);
  }

  isStuck(now: number = Date.now()): boolean {
    return this.idleMs(now) >= this.timeoutMs;
  }

  report(now: number = Date.now()): StuckReport {
    const idleMs = this.idleMs(now);
    return {
      stuck: idleMs >= this.timeoutMs,
      idleMs,
      timeoutMs: this.timeoutMs,
      advice: recoveryAdvice(idleMs, this.timeoutMs),
    };
  }
}

export function recoveryAdvice(idleMs: number, timeoutMs: number): string {
  if (idleMs < timeoutMs) return "en curso";
  return "Sin progreso > 10 min: valida que no sea un error real, refresca contexto/índice y reintenta; si persiste, cancela.";
}

export function recoveryAction(idleMs: number, timeoutMs: number): RecoveryAction | null {
  if (idleMs < timeoutMs) return null;
  return idleMs >= timeoutMs * 2 ? "abort" : "refresh-context";
}

export function diagnoseStuck(signals: { lastEvent: string; retries: number; externalWait: boolean; errorMessage?: string }): string {
  if (signals.errorMessage) return `error real: ${signals.errorMessage}`;
  if (signals.externalWait) return "espera externa (proveedor/red): reintenta o cambia de modelo";
  if (signals.retries >= 3) return "bucle de reintentos: resetea el plan y reduce el alcance";
  return `sin eventos desde "${signals.lastEvent}": refresca contexto y reintenta`;
}
