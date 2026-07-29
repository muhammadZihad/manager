import { invoke } from "@tauri-apps/api/core";

export type ImportCandidate = { name: string; command: string; source: string };

/** Detects package.json scripts and Makefile targets in a directory. */
export function detectImportableCommands(directory: string): Promise<ImportCandidate[]> {
  return invoke<ImportCandidate[]>("detect_importable_commands", { directory });
}
