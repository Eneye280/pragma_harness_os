import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";

function App(): React.ReactElement {
  const [status, setStatus] = useState("connecting…");

  useEffect(() => {
    window.harness?.ping().then((r) => setStatus(r.status)).catch(() => setStatus("offline"));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="h-9 flex items-center px-4 border-b border-zinc-800 bg-zinc-900/50 draggable">
        <span className="text-sm font-semibold tracking-tight">PRAGMA HARNESS OS</span>
        <span className="ml-3 text-xs px-2 py-0.5 rounded-full bg-violet-600 text-white">● {status}</span>
        <span className="ml-auto text-xs text-zinc-500">harness-first · TypeScript</span>
      </header>
      <main className="flex flex-1">
        <aside className="w-[260px] border-r border-zinc-800 p-4 hidden md:block">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Explorer</p>
          <p className="text-sm text-zinc-400 mt-2">Worktree + file tree vendrá en TASK 20</p>
        </aside>
        <section className="flex-1 flex flex-col max-w-[780px] mx-auto w-full p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Harness Controls. Agent Executes.</h1>
          <p className="text-zinc-400 mt-2">El harness compila todo antes de despertar al agente. TASK 01 scaffold listo.</p>
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-300">Scaffold Electron + Vite + React + Tailwind + shadcn operativo.</p>
            <p className="text-xs text-zinc-500 mt-2">Próximo: TASK 02 EventLog SQLite</p>
          </div>
        </section>
        <aside className="w-[320px] border-l border-zinc-800 p-4 hidden lg:block">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Context (harness)</p>
          <p className="text-sm text-zinc-400 mt-2">Live inspector vendrá en TASK 24</p>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
