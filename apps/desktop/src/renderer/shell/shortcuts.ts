export type ShellShortcut =
  | "toggle-explorer"
  | "toggle-context"
  | "command-palette"
  | "search-files"
  | "toggle-terminal"
  | "open-settings";

export interface KeyChord {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export function resolveShellShortcut(chord: KeyChord): ShellShortcut | null {
  const hasPrimaryModifier = Boolean(chord.metaKey || chord.ctrlKey);
  if (!hasPrimaryModifier || chord.altKey) return null;
  const key = chord.key.toLowerCase();
  if (chord.shiftKey && key === "c") return "toggle-context";
  if (chord.shiftKey) return null;
  if (key === "b") return "toggle-explorer";
  if (key === "k") return "command-palette";
  if (key === "p") return "search-files";
  if (key === "`") return "toggle-terminal";
  if (key === ",") return "open-settings";
  return null;
}

export function isEditableTarget(tagName: string, isContentEditable: boolean): boolean {
  if (isContentEditable) return true;
  const normalizedTag = tagName.toLowerCase();
  return normalizedTag === "input" || normalizedTag === "textarea" || normalizedTag === "select";
}
