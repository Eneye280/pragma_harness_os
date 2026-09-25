import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { IconClose } from "./icons";

interface TerminalPanelProps {
  height: number;
  onResize: (height: number) => void;
  onClose: () => void;
}

export function TerminalPanel({ height, onResize, onClose }: TerminalPanelProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef<string>("");
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 12.5,
      theme: {
        background: "#09090b",
        foreground: "#d4d4d8",
        cursor: "#8b5cf6",
        selectionBackground: "#3f3f46",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#f59e0b",
        blue: "#8b5cf6",
        magenta: "#a78bfa",
        cyan: "#22d3ee",
        white: "#f4f4f5",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch {
      // container not measured yet
    }

    terminal.write("harness terminal\r\n");
    window.harness?.terminal.start().then((session) => {
      terminal.write(`\x1b[90m${session.cwd}\x1b[0m\r\n${session.banner}`);
      setReady(true);
    });

    const unsubscribe = window.harness?.terminal.onData(({ data }) => terminal.write(data));

    const dataDisposable = terminal.onData((input) => {
      if (input === "\r") {
        terminal.write("\r\n");
        const line = lineBufferRef.current;
        lineBufferRef.current = "";
        void window.harness?.terminal.write(line);
        return;
      }
      if (input === "\u007f") {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          terminal.write("\b \b");
        }
        return;
      }
      if (input === "\u0003") {
        lineBufferRef.current = "";
        terminal.write("^C\r\n");
        return;
      }
      if (input >= " ") {
        lineBufferRef.current += input;
        terminal.write(input);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore transient fit errors
      }
    });
    resizeObserver.observe(container);

    return () => {
      unsubscribe?.();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      fitRef.current?.fit();
    } catch {
      // ignore
    }
  }, [height]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    dragStateRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    onResize(dragState.startHeight + (dragState.startY - event.clientY));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-hairline bg-surface" style={{ height }}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="h-1.5 cursor-row-resize bg-transparent transition-colors hover:bg-harness/40"
        role="separator"
        aria-label="Redimensionar terminal"
      />
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Terminal</span>
        {ready ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-harness" />}
        <span className="font-mono text-[10px] text-zinc-600">workspace pty</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar terminal"
          className="ml-auto rounded-control p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <IconClose width={13} height={13} />
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 px-2 py-1" />
    </div>
  );
}
