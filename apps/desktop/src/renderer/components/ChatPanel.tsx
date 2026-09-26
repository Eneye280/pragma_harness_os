import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { IconSend, IconSparkles } from "./icons";
import { HarnessStrip } from "../chat/HarnessStrip";
import { MarkdownView } from "../chat/MarkdownView";
import { ToolCallCard } from "../chat/ToolCallCard";
import { MessageTasks } from "./MessageTasks";
import { CHAT_WINDOW_SIZE, selectVisibleMessages } from "../chat/visible-messages";
import { describeAttachment, estimateAttachmentTokens, totalAttachmentTokens, type Attachment } from "@shared/attachments";
import { veracityReview } from "@shared/citations";
import type { UseChatResult } from "../chat/use-chat";

const SCROLL_THRESHOLD = 80;
const MAX_ATTACHMENTS = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const SUGGESTIONS = ["crea un archivo de nota", "agrega un endpoint /users", "revisa la seguridad del último cambio"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

const TEXT_EXTENSIONS = [".md", ".txt", ".csv", ".json", ".ts", ".tsx", ".js", ".jsx", ".cs", ".lua", ".glsl", ".yml", ".yaml", ".sql"];

function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  const lower = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function ChatPanel({ chat }: { chat: UseChatResult }): React.ReactElement {
  const { state, isRunning, send, steer, cancel } = chat;
  const [draft, setDraft] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [rememberTool, setRememberTool] = useState(false);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    if ((!draft.trim() && attachments.length === 0) || isRunning) return;
    send(draft || "(adjunto)", { bypassHarness, attachments });
    setDraft("");
    setAttachments([]);
  }

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setAttachmentError(null);
    const incoming = Array.from(files);
    const oversize = incoming.filter((file) => file.size > MAX_FILE_BYTES);
    const sized = incoming.filter((file) => file.size <= MAX_FILE_BYTES);
    const slots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const accepted = sized.slice(0, slots);
    if (oversize.length > 0) {
      setAttachmentError(`${oversize.length} archivo(s) superan 8MB y se omitieron`);
    } else if (sized.length > slots) {
      setAttachmentError(`máximo ${MAX_ATTACHMENTS} adjuntos`);
    }
    if (accepted.length === 0) return;
    const added: Attachment[] = [];
    for (const file of accepted) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      let dataUrl: string | undefined;
      let text: string | undefined;
      if (isImage) {
        dataUrl = await readAsDataUrl(file);
      } else if (isPdf) {
        dataUrl = await readAsDataUrl(file);
        const extracted = await window.harness?.attachments.extractText(dataUrl);
        text = extracted?.text || undefined;
      } else if (isTextFile(file)) {
        text = await readAsText(file);
      }
      added.push({
        id: `${Date.now()}-${file.name}`,
        kind: isImage ? "image" : "document",
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        text,
      });
    }
    setAttachments((current) => [...current, ...added].slice(0, MAX_ATTACHMENTS));
    setAttachmentAnnouncement(`${added.length} adjunto(s) añadido(s). Total ${totalAttachmentTokens([...attachments, ...added])} tokens estimados`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string): void {
    setAttachments((current) => {
      const next = current.filter((entry) => entry.id !== id);
      setAttachmentAnnouncement(`adjunto quitado. Quedan ${next.length}`);
      return next;
    });
  }

  function submitSteer(): void {
    if (!draft.trim()) return;
    steer(draft);
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
      if (isRunning) submitSteer();
      else submit(false);
    }
  }

  const { visible: visibleMessages, hiddenCount } = selectVisibleMessages(state.messages, revealedCount);
  const hasConversation = state.messages.length > 0;

  return (
    <div
      className="relative flex h-full flex-col bg-surface"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void handleFiles(event.dataTransfer?.files ?? null);
      }}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {attachmentAnnouncement}
      </div>
      <div aria-live="polite" role="status" className="sr-only">
        {isRunning ? "Harness trabajando" : state.error ? `harness error: ${state.error}` : ""}
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 px-6 py-6">
          {!hasConversation ? (
            <EmptyConversation onPick={(text) => send(text)} />
          ) : (
            <>
              {state.steps.length > 0 ? <HarnessStrip steps={state.steps} running={isRunning} /> : null}

              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setRevealedCount((count) => count + CHAT_WINDOW_SIZE)}
                  className="mx-auto rounded-panel border border-hairline bg-surface-raised px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Mostrar {Math.min(hiddenCount, CHAT_WINDOW_SIZE)} mensajes anteriores · {hiddenCount} ocultos
                </button>
              ) : null}

              {visibleMessages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="slide-up ml-auto max-w-[85%]">
                    {message.steer ? (
                      <span className="mb-0.5 block text-right text-[10px] text-harness-soft">añadido al run en curso</span>
                    ) : null}
                    {message.attachments && message.attachments.length > 0 ? (
                      <div className="mb-1 flex flex-wrap justify-end gap-1.5">
                        {message.attachments.map((attachment) =>
                          attachment.kind === "image" && attachment.dataUrl ? (
                            <img
                              key={attachment.id}
                              src={attachment.dataUrl}
                              alt={attachment.name}
                              className="h-16 w-16 rounded-control border border-hairline object-cover"
                            />
                          ) : (
                            <span key={attachment.id} className="rounded-control border border-hairline bg-surface-raised px-2 py-1 text-[10px] text-zinc-400">
                              {attachment.name}
                            </span>
                          ),
                        )}
                      </div>
                    ) : null}
                    <div className="rounded-sheet rounded-br-md border border-harness/30 bg-harness/15 px-3.5 py-2 text-[13px] text-zinc-100 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                      {message.content}
                    </div>
                    {message.attachments && message.attachments.length > 0 ? (
                      <p className="mt-0.5 text-right text-[10px] text-zinc-500">
                        {message.attachments.map((attachment) => describeAttachment(attachment)).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div key={message.id} className="slide-up flex gap-3">
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-panel border border-harness/30 bg-harness/15 text-harness-soft" aria-hidden="true">
                      <IconSparkles width={15} height={15} />
                    </span>
                    <div className="glass min-w-0 flex-1 rounded-sheet rounded-tl-md px-3.5 py-2.5">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] tracking-label text-harness-soft">harness</span>
                        <button
                          type="button"
                          aria-label="Copiar respuesta"
                          onClick={() => void navigator.clipboard?.writeText(message.content).catch(() => undefined)}
                          className="ml-auto rounded-control border border-hairline px-2 py-[1px] text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          copiar
                        </button>
                      </div>
                      <MarkdownView text={message.content} />
                      {!message.streaming && !veracityReview(message.content).ok ? (
                        <p className="mt-1 rounded-control border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300" role="note">
                          Afirma versiones o APIs sin citar una fuente verificable. Pide la referencia antes de confiar.
                        </p>
                      ) : null}
                      {message.streaming ? <span className="mt-1 inline-block h-3.5 w-1.5 animate-pulse bg-harness align-text-bottom" /> : null}
                      {message.tasks && message.tasks.length > 0 ? <MessageTasks tasks={message.tasks} /> : null}
                    </div>
                  </div>
                ),
              )}

              {state.pendingApproval ? (
                <div className="rounded-panel border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200" role="alertdialog" aria-label="Permiso de herramienta">
                  <p className="font-medium">El agente quiere ejecutar {state.pendingApproval.tool}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-amber-300/80">{state.pendingApproval.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-amber-300/90">
                      <input type="checkbox" checked={rememberTool} onChange={(event) => setRememberTool(event.target.checked)} />
                      recordar
                    </label>
                    <button
                      type="button"
                      onClick={() => chat.approveTool(state.pendingApproval!.callId, state.pendingApproval!.tool, "approve", rememberTool)}
                      className="ml-auto rounded-control bg-harness px-3 py-1 text-[11px] font-medium text-white hover:bg-harness-strong"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => chat.approveTool(state.pendingApproval!.callId, state.pendingApproval!.tool, "reject", rememberTool)}
                      className="rounded-control border border-red-500/40 px-3 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : null}

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
          aria-label="Ir al final de la conversación"
          className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full border border-hairline bg-zinc-800 px-3 py-1 text-[11px] text-zinc-300 shadow-lg transition-colors hover:bg-zinc-700"
        >
          ↓ scroll to bottom
        </button>
      ) : null}

      <div className="shrink-0 border-t border-hairline bg-surface px-6 py-4">
        {attachments.length > 0 ? (
          <div className="mx-auto mb-2 w-full max-w-[780px]">
            <p className="mb-1 text-[10px] text-zinc-500">
              {attachments.length} adjunto(s) · {totalAttachmentTokens(attachments)} tokens estimados
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <span key={attachment.id} className="flex items-center gap-2 rounded-control border border-hairline bg-surface-raised px-2 py-1">
                  {attachment.kind === "image" && attachment.dataUrl ? (
                    <img src={attachment.dataUrl} alt={attachment.name} className="h-6 w-6 rounded object-cover" />
                  ) : null}
                  <span className="max-w-[220px] truncate text-[10px] text-zinc-400" title={describeAttachment(attachment)}>
                    {attachment.name}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">{estimateAttachmentTokens(attachment)} tok</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    aria-label={`Quitar ${attachment.name}`}
                    className="text-[10px] text-zinc-500 transition-colors hover:text-red-300"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {attachmentError ? <p className="mx-auto mb-1 w-full max-w-[780px] text-[10px] text-red-400">{attachmentError}</p> : null}
        <div className="glass mx-auto flex w-full max-w-[780px] items-end gap-2 rounded-sheet p-2 focus-within:border-harness/50">
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Adjuntar archivo"
            accept="image/*,application/pdf,text/*"
            multiple
            hidden
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Adjuntar archivo"
            title="Adjuntar imagen o archivo"
            className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-control text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            +
          </button>
          <textarea
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(event) => {
              const files = event.clipboardData?.files;
              if (files && files.length > 0) {
                event.preventDefault();
                void handleFiles(files);
              }
            }}
            placeholder={isRunning ? "Añadir al run en curso… (Enter envía al agente)" : "Escribe un mensaje… (Enter envía)"}
            aria-label="Mensaje para el harness"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-500"
          />
          {isRunning ? (
            <button
              type="button"
              onClick={() => cancel()}
              aria-label="Detener el run"
              title="Detener"
              className="flex h-8 w-8 items-center justify-center rounded-control border border-red-500/40 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
            >
              <span aria-hidden="true">■</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={!draft.trim()}
              aria-label="Send message"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-control transition-colors",
                !draft.trim() ? "bg-zinc-800 text-zinc-600" : "bg-harness text-white hover:bg-harness-strong",
              )}
            >
              <IconSend width={15} height={15} />
            </button>
          )}
        </div>
        <p className="mx-auto mt-2 w-full max-w-[780px] text-[10px] text-zinc-600">
          {isRunning
            ? "Enter añade al run en curso (se re-evalúa y continúa) · ■ detiene"
            : "Enter envía · Shift+Enter salto de línea · Ctrl/Cmd+Enter fuerza sin harness"}
        </p>
      </div>
    </div>
  );
}

function EmptyConversation({ onPick }: { onPick: (text: string) => void }): React.ReactElement {
  return (
    <>
      <div className="slide-up flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-panel bg-harness/15 text-harness-soft" aria-hidden="true">
          <IconSparkles width={18} height={18} />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Harness Controls. Agent Executes.</h1>
          <p className="text-[12px] text-zinc-400">El harness compila reglas, skills, RAG y contexto antes de despertar al agente.</p>
        </div>
      </div>

      <div className="slide-up rounded-panel border border-hairline bg-surface-raised p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Empieza</p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
          Escribe un mensaje y verás los pasos del harness, la respuesta en streaming y los tool calls con su diff.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-panel border border-harness/30 bg-harness/10 px-2.5 py-1 text-[11px] text-harness-soft transition-colors hover:bg-harness/20"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
