import { describe, it, expect } from "vitest";
import { CHAT_WINDOW_SIZE, CHAT_WINDOW_THRESHOLD, selectVisibleMessages } from "../visible-messages";

function messages(count: number): number[] {
  return Array.from({ length: count }, (_value, index) => index);
}

describe("chat list windowing", () => {
  it("renders everything below the threshold", () => {
    const result = selectVisibleMessages(messages(40));
    expect(result.hiddenCount).toBe(0);
    expect(result.visible).toHaveLength(40);
  });

  it("keeps the tail once the conversation exceeds the threshold", () => {
    const result = selectVisibleMessages(messages(150));
    expect(result.hiddenCount).toBe(150 - CHAT_WINDOW_SIZE);
    expect(result.visible).toHaveLength(CHAT_WINDOW_SIZE);
    expect(result.visible.at(-1)).toBe(149);
    expect(result.visible[0]).toBe(150 - CHAT_WINDOW_SIZE);
  });

  it("grows the window as earlier messages are revealed", () => {
    const first = selectVisibleMessages(messages(120), 0);
    const expanded = selectVisibleMessages(messages(120), 20);
    expect(expanded.hiddenCount).toBeLessThan(first.hiddenCount);
    expect(expanded.visible).toHaveLength(CHAT_WINDOW_SIZE + 20);
  });

  it("honours a custom threshold", () => {
    const result = selectVisibleMessages(messages(12), 0, 10, 5);
    expect(result.hiddenCount).toBe(7);
    expect(result.visible).toHaveLength(5);
  });

  it("exposes sane defaults", () => {
    expect(CHAT_WINDOW_THRESHOLD).toBe(100);
    expect(CHAT_WINDOW_SIZE).toBe(60);
  });
});
