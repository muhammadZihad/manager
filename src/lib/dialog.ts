import { open } from "@tauri-apps/plugin-dialog";

/** Opens a native folder picker. Returns null if the user cancels. */
export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  const result = await open({ directory: true, multiple: false, defaultPath });
  if (Array.isArray(result)) return result[0] ?? null;
  return result;
}
