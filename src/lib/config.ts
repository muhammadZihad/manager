// Typed wrappers over the Tauri config commands (src-tauri/src/config.rs).
// The backend persists whatever JSON it's handed at app_config_dir()/projects.json.

import { invoke } from "@tauri-apps/api/core";
import type { Config } from "../types";

export function loadConfig(): Promise<Config> {
  return invoke<Config>("load_config");
}

export function saveConfig(config: Config): Promise<void> {
  return invoke<void>("save_config", { config });
}
