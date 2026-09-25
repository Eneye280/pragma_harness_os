import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ChatStreamEvent } from "@shared/chat-events";
import { INITIAL_CHAT_STATE, chatReducer, type ChatState } from "./chat-reducer";

function createId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseChatResult {
  state: ChatState;
  sessionId: string;
  isRunning: boolean;
  send: (text: string, options?: { bypassHarness?: boolean }) => void;
  approvePlan: (markdown: string) => void;
  discardPlan: () => void;
  revisePlan: (markdown: string) => void;
  reset: () => void;
}

export function useChat(): UseChatResult {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const sessionRef = useRef<string>(createId());
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) return;
    return bridge.onChatEvent((event: ChatStreamEvent) => {
      dispatch({ type: "stream", event });
      if (event.kind === "error") setIsRunning(false);
      if (event.kind === "harness-step" && event.phase === "agent" && event.status === "done") setIsRunning(false);
    });
  }, []);

  const send = useCallback((text: string, options?: { bypassHarness?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    dispatch({ type: "send", id: createId(), text: trimmed });
    setIsRunning(true);
    window.harness
      ?.sendMessage(trimmed, { sessionId: sessionRef.current, bypassHarness: options?.bypassHarness })
      .catch(() => {
        dispatch({
          type: "stream",
          event: { kind: "error", sessionId: sessionRef.current, message: "no se pudo contactar al harness" },
        });
        setIsRunning(false);
      });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    setIsRunning(false);
  }, []);

  const approvePlan = useCallback(
    (markdown: string) => {
      void window.harness?.plan.approve(sessionRef.current, markdown);
    },
    [],
  );

  const discardPlan = useCallback(() => {
    void window.harness?.plan.discard(sessionRef.current);
  }, []);

  const revisePlan = useCallback(
    (markdown: string) => {
      void window.harness?.plan.revise(sessionRef.current, markdown);
    },
    [],
  );

  return { state, sessionId: sessionRef.current, isRunning, send, approvePlan, discardPlan, revisePlan, reset };
}
