export interface PtyProcessLike {
  onData(callback: (data: string) => void): void;
  onExit(callback: (event: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export interface PtyAdapterLike {
  spawn(file: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: NodeJS.ProcessEnv }): PtyProcessLike;
}

export async function loadNodePty(): Promise<PtyAdapterLike | null> {
  const specifier = "node-pty";
  try {
    const module = (await import(specifier)) as unknown as PtyAdapterLike;
    return typeof module.spawn === "function" ? module : null;
  } catch {
    return null;
  }
}
