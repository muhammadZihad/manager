import { invoke } from "@tauri-apps/api/core";

/** Listening TCP ports per session id. Empty on platforms without support. */
export function sessionPorts(): Promise<Record<string, number[]>> {
  return invoke<Record<string, number[]>>("session_ports");
}
