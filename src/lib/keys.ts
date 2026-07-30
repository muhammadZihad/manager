// Keybinding encoding, matching and display.
//
// Bindings are stored as a canonical string like "Mod+Shift+T", where `Mod`
// resolves to Cmd on macOS and Ctrl everywhere else. Storing `Mod` rather than
// the literal key means one config file behaves correctly on every platform.
//
// Modifier order is always Mod, Alt, Shift, then the key — so the same chord
// always produces the same string and conflicts can be found with ===.

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Modifier-only presses can't be a binding on their own. */
const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "CapsLock", "Dead"]);

const CODE_TO_KEY: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Space: "Space",
};

/**
 * Canonical chord for an event, or null if only modifiers are held.
 *
 * Letters and digits are read from `e.code`, not `e.key`, because `e.key`
 * changes with modifiers — Shift+/ reports "?", and on macOS Alt+T reports "†".
 * Using the physical key keeps a stored binding matching the same keycap.
 */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  let key: string;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (CODE_TO_KEY[e.code]) key = CODE_TO_KEY[e.code];
  else if (e.key === " ") key = "Space";
  else key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

/** True when the event is the chord described by `combo`. */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  return comboFromEvent(e) === combo;
}

const DISPLAY_MAC: Record<string, string> = {
  Mod: "⌘",
  Alt: "⌥",
  Shift: "⇧",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Enter: "↩",
  Backspace: "⌫",
  Escape: "esc",
  Space: "space",
};

const DISPLAY_OTHER: Record<string, string> = {
  Mod: "Ctrl",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

/** Human-readable chord: "⌘⇧T" on macOS, "Ctrl+Shift+T" elsewhere. */
export function formatCombo(combo: string): string {
  if (!combo) return "Unassigned";
  const map = IS_MAC ? DISPLAY_MAC : DISPLAY_OTHER;
  const parts = combo.split("+").map((p) => map[p] ?? p);
  return IS_MAC ? parts.join("") : parts.join("+");
}

/** Chords assigned to more than one action, so the UI can flag every row involved. */
export function findConflicts(bindings: Record<string, string>): Set<string> {
  const counts = new Map<string, number>();
  for (const combo of Object.values(bindings)) {
    if (!combo) continue;
    counts.set(combo, (counts.get(combo) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([combo]) => combo));
}

/**
 * Chords the terminal needs more than the app does. A chord the app handles is
 * one the PTY never sees, so claiming these would silently break shell and
 * readline editing (clear, kill-line, delete-word, transpose…).
 */
const RESERVED = new Set([
  "Mod+A",
  "Mod+C",
  "Mod+D",
  "Mod+E",
  "Mod+K",
  "Mod+L",
  "Mod+R",
  "Mod+T",
  "Mod+U",
  "Mod+V",
  "Mod+W",
  "Mod+Z",
]);

export function isReserved(combo: string): boolean {
  return RESERVED.has(combo);
}
