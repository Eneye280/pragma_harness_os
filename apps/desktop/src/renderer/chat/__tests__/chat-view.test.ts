import { describe, expect, it } from "vitest";
import { loadChatView, saveChatView } from "../use-chat-view";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("chat view preference", () => {
  it("defaults to conversation and persists graph per project", () => {
    const storage = memoryStorage();
    expect(loadChatView(storage, "/repo/a")).toBe("conversation");
    saveChatView(storage, "/repo/a", "graph");
    expect(loadChatView(storage, "/repo/a")).toBe("graph");
    expect(loadChatView(storage, "/repo/b")).toBe("conversation");
  });

  it("survives storage failures", () => {
    const broken = {
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {
        throw new Error("nope");
      },
    };
    expect(loadChatView(broken, "/x")).toBe("conversation");
    expect(() => saveChatView(broken, "/x", "graph")).not.toThrow();
  });
});
