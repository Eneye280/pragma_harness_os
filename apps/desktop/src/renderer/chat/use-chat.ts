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
  openSession: (id: string) => Promise<void>;
  startNewSession: () => void;
  steer: (text: string) => void;
  cancel: () => void;
  reset: () => void;
}

export function useChat(workspacePath = ""): UseChatResult {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const sessionRef = useRef<string>(createId());
  const [sessionId, setSessionId] = useState<string>(() => sessionRef.current);
  const [isRunning, setIsRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const adoptSession = useCallback((id: string) => {
    sessionRef.current = id;
    setSessionId(id);
  }, []);

  useEffect(() => {
    const bridge = window.harness;
    if (!bridge) return;
    return bridge.onChatEvent((event: ChatStreamEvent) => {
      dispatch({ type: "stream", event });
      if (event.kind === "error") setIsRunning(false);
      if (event.kind === "harness-step" && event.phase === "agent" && event.status === "done") setIsRunning(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    if (!workspacePath) {
      adoptSession(createId());
      setHydrated(true);
      return;
    }
    const bridge = window.harness?.sessions;
    if (!bridge) {
      setHydrated(true);
      return;
    }
    bridge
      .latest(workspacePath)
      .then((result) => {
        if (cancelled) return;
        if (result.session) {
          adoptSession(result.session.summary.id);
          dispatch({ type: "restore", state: result.session.state });
        } else {
          adoptSession(createId());
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, adoptSession]);

  useEffect(() => {
    if (!hydrated || !workspacePath) return;
    const bridge = window.harness?.sessions;
    if (!bridge) return;
    const handle = setTimeout(() => {
      void bridge.save({
        id: sessionRef.current,
        workspacePath,
        messageCount: state.messages.length,
        state,
      });
    }, 600);
    return () => clearTimeout(handle);
  }, [state, hydrated, workspacePath]);

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

  const openSession = useCallback(
    async (id: string) => {
      const bridge = window.harness?.sessions;
      if (!bridge) return;
      const result = await bridge.get(id);
      if (!result.session) return;
      adoptSession(id);
      dispatch({ type: "restore", state: result.session.state });
      setIsRunning(false);
    },
    [adoptSession]
  );

  const startNewSession = useCallback(() => {
    adoptSession(createId());
    dispatch({ type: "reset" });
    setIsRunning(false);
  }, [adoptSession]);

  const steer = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void window.harness?.steer(sessionRef.current, trimmed);
  }, []);

  const cancel = useCallback(() => {
    void window.harness?.cancel(sessionRef.current);
    setIsRunning(false);
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

  return { state, sessionId, isRunning, send, approvePlan, discardPlan, revisePlan, openSession, startNewSession, steer, cancel, reset };
}
