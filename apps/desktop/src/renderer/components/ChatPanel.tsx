import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { IconSend, IconSparkles } from "./icons";
import { HarnessStrip } from "../chat/HarnessStrip";
import { MarkdownView } from "../chat/MarkdownView";
import { ToolCallCard } from "../chat/ToolCallCard";
import type { UseChatResult } from "../chat/use-chat";

const SCROLL_THRESHOLD = 80;

export function ChatPanel({ chat }: { chat: UseChatResult }): React.ReactElement {
  const { state, isRunning, send } = chat;
  const [draft, setDraft] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function isNearBottom(): boolean {
    const element = scrollRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < SCROLL_THRESHOLD;
  }

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < SCROLL_THRESHOLD;
    if (nearBottom) {
      element.scrollTop = element.scrollHeight;
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  }, [state.messages, state.toolCalls, state.steps]);

  function handleScroll(): void {
    if (isNearBottom()) {
      setShowScrollButton(false);
    }
  }

  function scrollToBottom(): void {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setShowScrollButton(false);
  }

  function submit(bypassHarness: boolean): void {
    if (!draft.trim() || isRunning) return;
    send(draft, { bypassHarness });
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && event.shiftKey) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit(true);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit(false);
    }
  }

  const hasConversation = state.messages.length > 0;

  return (
    <div className="relative flex h-full flex-col bg-surface">
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 px-6 py-6">
          {!hasConversation ? (
            <EmptyConversation />
          ) : (
            <>
              {state.steps.length > 0 ? <HarnessStrip steps={state.steps} running={isRunning} /> : null}

              {state.messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="ml-auto max-w-[85%] rounded-panel border border-harness/30 bg-harness/10 px-3.5 py-2 text-[13px] text-zinc-100">
                    {message.content}
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-panel bg-zinc-800 text-harness-soft">
                      <IconSparkles width={15} height={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <MarkdownView text={message.content} />
                      {message.streaming ? <span className="mt-1 inline-block h-3.5 w-1.5 animate-pulse bg-harness align-text-bottom" /> : null}
                    </div>
                  </div>
                ),
              )}

              {state.toolCalls.map((call) => (
                <ToolCallCard key={call.callId} call={call} />
              ))}

              {state.error ? (
                <div className="rounded-panel border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                  harness error: {state.error}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-zinc-800 px-3 py-1 text-[11px] text-zinc-300 shadow-lg transition-colors hover:bg-zinc-700"
        >
          ↓ scroll to bottom
        </button>
      ) : null}

      <div className="shrink-0 border-t border-hairline bg-surface px-6 py-4">
        <div className="mx-auto flex w-full max-w-[780px] items-end gap-2 rounded-panel border border-hairline bg-surface-raised p-2 focus-within:border-harness/50">
          <textarea
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? "Harness trabajando…" : "Escribe un mensaje… (Enter envía)"}
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!draft.trim() || isRunning}
            aria-label="Send message"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-control transition-colors",
              !draft.trim() || isRunning ? "bg-zinc-800 text-zinc-600" : "bg-harness text-white hover:bg-harness-strong",
            )}
          >
            <IconSend width={15} height={15} />
          </button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-[780px] text-[10px] text-zinc-600">
          Enter envía · Shift+Enter salto de línea · Ctrl/Cmd+Enter fuerza sin harness
        </p>
      </div>
    </div>
  );
}

function EmptyConversation(): React.ReactElement {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-harness/15 text-harness-soft">
          <IconSparkles width={18} height={18} />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Harness Controls. Agent Executes.</h1>
          <p className="text-[12px] text-zinc-500">El harness compila reglas, skills, RAG y contexto antes de despertar al agente.</p>
        </div>
      </div>

      <div className="rounded-panel border border-hairline bg-surface-raised p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Empieza</p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
          Escribe un mensaje y verás los pasos del harness, la respuesta en streaming y los tool calls con su diff.
        </p>
        <p className="mt-2 text-[12px] text-zinc-500">
          Prueba <span className="text-harness-soft">"crea un archivo de nota"</span> para ver un <span className="text-harness-soft">fileEdit</span> con diff inline.
        </p>
      </div>
    </>
  );
}
