// Core data model, persisted as a single JSON config file by the Rust backend
// (src-tauri/src/config.rs just stores whatever shape we send it).

export type ItemGroup = "commands" | "terminals" | "agents";

export type AgentProvider = "claude" | "codex" | "custom";

export type Runnable = {
  id: string;
  name: string;
  /** Full shell command, e.g. "npm run dev" or "claude". Omitted for Terminals => platform default shell. */
  command?: string;
  /** Working directory. Falls back to the project's directory when omitted. */
  cwd?: string;
  env: Record<string, string>;
  /** Whether this item is included when the project's "Start" is clicked. */
  autoStart: boolean;
};

export type Agent = Runnable & { provider: AgentProvider };

export type Project = {
  id: string;
  name: string;
  directory: string;
  commands: Runnable[];
  terminals: Runnable[];
  agents: Agent[];
};

export type ThemeMode = "dark" | "light" | "system";

export type AppSettings = {
  theme: ThemeMode;
  /** Fallback shell for Terminal items left blank. Undefined => OS default ($SHELL/COMSPEC). */
  defaultShell?: string;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalScrollback: number;
  confirmBeforeDelete: boolean;
};

export const defaultAppSettings: AppSettings = {
  theme: "system",
  defaultShell: undefined,
  terminalFontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
  terminalFontSize: 13,
  terminalScrollback: 2000,
  confirmBeforeDelete: true,
};

export const TERMINAL_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', Menlo, Consolas, monospace" },
  { label: "Menlo", value: "Menlo, Consolas, monospace" },
  { label: "Fira Code", value: "'Fira Code', Menlo, monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', Menlo, monospace" },
  { label: "SF Mono", value: "'SF Mono', Menlo, monospace" },
  { label: "Consolas", value: "Consolas, Menlo, monospace" },
];

export type Config = {
  version: 1;
  settings: AppSettings;
  projects: Project[];
};

export const emptyConfig: Config = { version: 1, settings: defaultAppSettings, projects: [] };

export function itemsForGroup(project: Project, group: ItemGroup): Runnable[] {
  return project[group];
}
