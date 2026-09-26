import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ChatStreamEvent } from "@shared/chat-events";
import {
  INITIAL_CHAT_STATE,
  sessionStatesReducer,
  type ChatState,
  type SessionStates,
} from "./chat-reducer";

function createId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseChatResult {
  state: ChatState;
  sessionId: string;
  isRunning: boolean;
  runningSessions: string[];
  send: (text: string, options?: { bypassHarness?: boolean }) => void;
  approvePlan: (markdown: string) => void;
  discardPlan: () => void;
  revisePlan: (markdown: string) => void;
  openSession: (id: string) => Promise<void>;
  startNewSession: () => void;
  steer: (text: string) => void;
  cancel: (sessionId?: string) => void;
  reset: () => void;
}

export function useChat(workspacePath = ""): UseChatResult {
  const [states, dispatch] = useReducer(sessionStatesReducer, {} as SessionStates);
  const sessionRef = useRef<string>(createId());
  const [sessionId, setSessionId] = useState<string>(() => sessionRef.current);
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
          dispatch({ type: "restore", sessionId: result.session.summary.id, state: result.session.state });
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
      for (const [id, state] of Object.entries(states)) {
        if (state.messages.length === 0) continue;
        void bridge.save({ id, workspacePath, messageCount: state.messages.length, state });
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [states, hydrated, workspacePath]);

  const send = useCallback((text: string, options?: { bypassHarness?: boolean }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = createId();
    dispatch({ type: "send", sessionId: sessionRef.current, id, text: trimmed });
    window.harness
      ?.sendMessage(trimmed, { sessionId: sessionRef.current, bypassHarness: options?.bypassHarness })
      .catch(() => {
        dispatch({
          type: "stream",
          event: { kind: "error", sessionId: sessionRef.current, message: "no se pudo contactar al harness" },
        });
      });
  }, []);

  const openSession = useCallback(
    async (id: string) => {
      const bridge = window.harness?.sessions;
      if (!bridge) return;
      const result = await bridge.get(id);
      if (!result.session) return;
      adoptSession(id);
      dispatch({ type: "restore", sessionId: id, state: result.session.state });
    },
    [adoptSession]
  );

  const startNewSession = useCallback(() => {
    const id = createId();
    adoptSession(id);
    dispatch({ type: "reset", sessionId: id });
  }, [adoptSession]);

  const steer = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void window.harness?.steer(sessionRef.current, trimmed);
  }, []);

  const cancel = useCallback((targetSessionId?: string) => {
    void window.harness?.cancel(targetSessionId ?? sessionRef.current);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset", sessionId: sessionRef.current });
  }, []);

  const approvePlan = useCallback((markdown: string) => {
    void window.harness?.plan.approve(sessionRef.current, markdown);
  }, []);

  const discardPlan = useCallback(() => {
    void window.harness?.plan.discard(sessionRef.current);
  }, []);

  const revisePlan = useCallback((markdown: string) => {
    void window.harness?.plan.revise(sessionRef.current, markdown);
  }, []);

  const state = states[sessionId] ?? INITIAL_CHAT_STATE;
  const runningSessions = Object.entries(states)
    .filter(([, sessionState]) => sessionState.agentPhase === "running")
    .map(([id]) => id);

  return {
    state,
    sessionId,
    isRunning: state.agentPhase === "running",
    runningSessions,
    send,
    approvePlan,
    discardPlan,
    revisePlan,
    openSession,
    startNewSession,
    steer,
    cancel,
    reset,
  };
}
