export const CHAT_WINDOW_THRESHOLD = 100;
export const CHAT_WINDOW_SIZE = 60;

export interface VisibleWindow<T> {
  visible: T[];
  hiddenCount: number;
}

export function selectVisibleMessages<T>(messages: T[], expandedCount = 0, threshold = CHAT_WINDOW_THRESHOLD, windowSize = CHAT_WINDOW_SIZE): VisibleWindow<T> {
  const limit = windowSize + Math.max(0, expandedCount);
  if (messages.length <= Math.max(threshold, limit)) {
    return { visible: messages, hiddenCount: 0 };
  }
  const hiddenCount = messages.length - limit;
  return { visible: messages.slice(hiddenCount), hiddenCount };
}
