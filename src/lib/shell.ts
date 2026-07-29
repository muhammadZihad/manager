import { invoke } from "@tauri-apps/api/core";

/** Shells detected on this system (from /etc/shells on macOS/Linux, a fixed list on Windows). */
export function listShells(): Promise<string[]> {
  return invoke<string[]>("list_shells");
}
