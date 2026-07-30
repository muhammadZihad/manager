// Per-project settings file, kept inside the project directory so a team can
// commit it and share one set of commands, agents and terminals.
//
// The app's own projects.json still holds a copy of everything. This file is
// authoritative when it exists — that's what makes `git pull` bring a
// teammate's new command with it — but if the folder is missing (external
// drive, moved repo) the project still loads from projects.json.

import { invoke } from "@tauri-apps/api/core";
import type { Agent, Project, Runnable } from "../types";

/** Shape written to disk. */
type ProjectConfigFile = {
  version: 1;
  name: string;
  commands: Runnable[];
  agents: Agent[];
  terminals: Runnable[];
};

/**
 * Filesystem-safe file name. Project names are free text, so anything that
 * would change the path or upset a shell is replaced rather than escaped.
 */
export function projectConfigFileName(projectName: string): string {
  const safe =
    projectName
      .trim()
      .replace(/[/\\:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "") || "project";
  return `${safe}.settings.js`;
}

/** Absolute path of a project's settings file, or null without a directory. */
export function projectConfigPath(project: Project): string | null {
  const dir = project.directory.trim().replace(/[/\\]+$/, "");
  if (!dir) return null;
  return `${dir}/${projectConfigFileName(project.name)}`;
}

/**
 * `id` and `directory` are deliberately omitted: both are specific to one
 * machine, and writing them would make the file useless to share.
 */
function toFile(project: Project): ProjectConfigFile {
  return {
    version: 1,
    name: project.name,
    commands: project.commands,
    agents: project.agents,
    terminals: project.terminals,
  };
}

export async function writeProjectConfig(project: Project): Promise<void> {
  const path = projectConfigPath(project);
  if (!path) return;
  await invoke("save_project_config", { path, config: toFile(project) });
}

/**
 * Merge a project's settings file over the in-app copy. Returns the project
 * unchanged when the file is absent or unreadable.
 */
export async function mergeProjectConfig(project: Project): Promise<Project> {
  const path = projectConfigPath(project);
  if (!path) return project;

  const loaded = await invoke<ProjectConfigFile | null>("load_project_config", { path }).catch(
    () => null,
  );
  if (!loaded) return project;

  return {
    ...project,
    // Keep the local id and directory; take everything else from the file.
    name: typeof loaded.name === "string" && loaded.name ? loaded.name : project.name,
    commands: Array.isArray(loaded.commands) ? loaded.commands : project.commands,
    agents: Array.isArray(loaded.agents) ? loaded.agents : project.agents,
    terminals: Array.isArray(loaded.terminals) ? loaded.terminals : project.terminals,
  };
}

/** Write the settings file for every project that has the option enabled. */
export async function syncProjectConfigs(projects: Project[]): Promise<void> {
  await Promise.all(
    projects
      .filter((p) => p.storeConfigInProject && p.directory.trim())
      .map((p) => writeProjectConfig(p).catch(() => {})),
  );
}

/** Apply any on-disk settings files during startup. */
export async function applyProjectConfigs(projects: Project[]): Promise<Project[]> {
  return Promise.all(
    projects.map((p) => (p.storeConfigInProject ? mergeProjectConfig(p).catch(() => p) : p)),
  );
}
