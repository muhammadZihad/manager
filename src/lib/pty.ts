// Typed wrappers over the Tauri PTY commands/events (src-tauri/src/pty.rs).
//
// Contract:
//  - spawnSession returns a session id but does NOT start streaming output yet.
//  - The caller must attach its onOutput/onExit listeners, THEN call
//    startReading(sessionId) — this avoids a race where a fast program's first
//    output arrives before the frontend is listening for it.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type SpawnOpts = {
  program?: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
};

type OutputPayload = { data: string }; // base64-encoded raw bytes
type ExitPayload = { session_id: string; code: number | null };

export function spawnSession(opts: SpawnOpts): Promise<string> {
  return invoke<string>("spawn_session", { opts });
}

export function startReading(sessionId: string): Promise<void> {
  return invoke<void>("start_reading", { sessionId });
}

export function writeToSession(sessionId: string, data: string): Promise<void> {
  return invoke<void>("write_to_session", { sessionId, data });
}

export function resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>("resize_session", { sessionId, cols, rows });
}

export function killSession(sessionId: string): Promise<void> {
  return invoke<void>("kill_session", { sessionId });
}

export function onOutput(sessionId: string, cb: (bytes: Uint8Array) => void): Promise<UnlistenFn> {
  return listen<OutputPayload>(`pty://output/${sessionId}`, (e) => {
    cb(base64ToBytes(e.payload.data));
  });
}

export function onExit(sessionId: string, cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<ExitPayload>(`pty://exit/${sessionId}`, (e) => {
    cb(e.payload.code);
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
