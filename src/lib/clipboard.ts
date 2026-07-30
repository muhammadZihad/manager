// Clipboard access via Tauri's clipboard-manager plugin rather than
// navigator.clipboard: reading the clipboard is gated behind user-gesture and
// permission checks in WKWebView that a context-menu click doesn't reliably
// satisfy, whereas the plugin goes through the native clipboard directly.

import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text).catch(() => {});
}

export async function readClipboard(): Promise<string> {
  return readText().catch(() => "");
}

/**
 * Insert text at the caret of the focused input/textarea.
 *
 * Uses execCommand("insertText") deliberately: it produces a real `input`
 * event, so React controlled components update their state. Assigning to
 * `element.value` directly would change the DOM but leave React's state stale.
 */
export function insertTextAtCaret(text: string): void {
  if (!text) return;
  document.execCommand("insertText", false, text);
}

/** Selected text inside an input/textarea, or "" when nothing is selected. */
export function inputSelection(el: HTMLInputElement | HTMLTextAreaElement): string {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return "";
  return el.value.slice(start, end);
}
