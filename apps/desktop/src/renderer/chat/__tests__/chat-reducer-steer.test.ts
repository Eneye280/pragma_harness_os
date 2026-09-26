import { describe, it, expect } from "vitest";
import { INITIAL_CHAT_STATE, chatReducer } from "../chat-reducer";

describe("chat reducer — steered user message", () => {
  it("appends a steered user message to the timeline", () => {
    const next = chatReducer(INITIAL_CHAT_STATE, {
      type: "stream",
      event: { kind: "user-message", sessionId: "s1", text: "usa licencias", steer: true },
    });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toMatchObject({ role: "user", content: "usa licencias", steer: true, streaming: false });
  });
});
