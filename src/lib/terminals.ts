// Registry of live xterm instances, keyed by a tab's runId.
//
// The context menu needs to act on the terminal the user right-clicked
// (copy its selection, clear it, select all) without that terminal being
// passed down through props from wherever the menu happens to live.

import type { Terminal as XTerm } from "@xterm/xterm";

const terminals = new Map<string, XTerm>();

export function registerTerminal(runId: string, term: XTerm): void {
  terminals.set(runId, term);
}

export function unregisterTerminal(runId: string, term: XTerm): void {
  // Guard against a remount having already replaced this entry.
  if (terminals.get(runId) === term) terminals.delete(runId);
}

export function getTerminal(runId: string): XTerm | null {
  return terminals.get(runId) ?? null;
}
