import { invoke } from "@tauri-apps/api/core";

export type SessionUsage = {
  /** Summed across the process tree, so it can exceed 100% on multiple cores. */
  cpu_percent: number;
  memory_bytes: number;
  /** Descendants of the spawned process, excluding it. */
  subprocesses: number;
};

/** Null once the process is gone. */
export function sessionUsage(sessionId: string): Promise<SessionUsage | null> {
  return invoke<SessionUsage | null>("session_usage", { sessionId });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal below 100 keeps the width stable without looking imprecise.
  return `${value < 100 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
