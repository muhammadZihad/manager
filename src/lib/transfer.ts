// Export/import projects to/from a standalone JSON file, via native
// save/open dialogs. Used for backup, moving to a new machine, or sharing a
// team's setup — see src-tauri/src/transfer.rs for the file I/O side.

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Project } from "../types";

const FILTERS = [{ name: "Manager Projects", extensions: ["json"] }];

/** Returns true if the export completed, false if the user cancelled the save dialog. */
export async function exportProjectsToFile(projects: Project[], defaultName: string): Promise<boolean> {
  const path = await save({ defaultPath: `${defaultName}.json`, filters: FILTERS });
  if (!path) return false;
  await invoke("export_projects", { path, projects });
  return true;
}

/** Returns the imported projects, or null if the user cancelled the open dialog. */
export async function importProjectsFromFile(): Promise<Project[] | null> {
  const picked = await open({ multiple: false, filters: FILTERS });
  const path = Array.isArray(picked) ? picked[0] : picked;
  if (!path) return null;
  const data = await invoke<unknown>("import_projects", { path });
  return Array.isArray(data) ? (data as Project[]) : [data as Project];
}
