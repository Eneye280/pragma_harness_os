import { useCallback, useEffect, useState } from "react";

export type ChatView = "conversation" | "graph";

const STORAGE_PREFIX = "phs:chat-view:";

/** Vista guardada para un proyecto (por defecto, conversación). */
export function loadChatView(storage: Pick<Storage, "getItem">, workspacePath: string): ChatView {
  try {
    return storage.getItem(STORAGE_PREFIX + workspacePath) === "graph" ? "graph" : "conversation";
  } catch {
    return "conversation";
  }
}

export function saveChatView(storage: Pick<Storage, "setItem">, workspacePath: string, view: ChatView): void {
  try {
    storage.setItem(STORAGE_PREFIX + workspacePath, view);
  } catch {
    // persistence is best-effort
  }
}

export function useChatView(workspacePath: string): [ChatView, (view: ChatView) => void] {
  const [view, setView] = useState<ChatView>(() =>
    typeof window === "undefined" || !window.localStorage ? "conversation" : loadChatView(window.localStorage, workspacePath),
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    setView(loadChatView(window.localStorage, workspacePath));
  }, [workspacePath]);

  const update = useCallback(
    (next: ChatView) => {
      setView(next);
      if (typeof window !== "undefined" && window.localStorage) saveChatView(window.localStorage, workspacePath, next);
    },
    [workspacePath],
  );

  return [view, update];
}
