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
  /**
   * Mirror this project's items to `{name}.settings.js` in its own directory, so
   * the setup can be committed and shared. Optional for backward compatibility
   * with configs written before this existed.
   */
  storeConfigInProject?: boolean;
  commands: Runnable[];
  terminals: Runnable[];
  agents: Agent[];
};

export type ThemeMode = "dark" | "light" | "system";

export type CursorStyle = "block" | "underline" | "bar";

/**
 * Rebindable commands. Project switching (Mod+1…9) is deliberately excluded —
 * it's a range of nine bindings rather than a single one, so it stays fixed.
 */
export type KeybindingAction =
  | "newTerminal"
  | "closeTab"
  | "nextTab"
  | "prevTab"
  | "startProject"
  | "stopAllSessions"
  | "openAppSettings"
  | "openProjectSettings"
  | "focusSearch";

export type Keybindings = Record<KeybindingAction, string>;

/**
 * `Mod` means Cmd on macOS and Ctrl elsewhere.
 *
 * Defaults avoid bare Mod+T / Mod+W / Mod+K etc. because those are real shell
 * and readline bindings (transpose-chars, delete-word-backward, clear) that a
 * focused terminal legitimately wants. Anything the app claims is a keystroke
 * the shell can never see, so the app claims as little as possible.
 */
export const defaultKeybindings: Keybindings = {
  newTerminal: "Mod+Shift+T",
  closeTab: "Mod+Shift+W",
  nextTab: "Mod+Alt+ArrowRight",
  prevTab: "Mod+Alt+ArrowLeft",
  startProject: "Mod+Shift+R",
  stopAllSessions: "Mod+Shift+X",
  openAppSettings: "Mod+,",
  openProjectSettings: "Mod+Shift+,",
  focusSearch: "Mod+Shift+F",
};

export const KEYBINDING_META: { action: KeybindingAction; label: string; hint: string }[] = [
  { action: "newTerminal", label: "New terminal", hint: "Opens a shell in the active project" },
  { action: "closeTab", label: "Close session", hint: "Closes the session currently shown" },
  { action: "nextTab", label: "Next session", hint: "Cycle forward through open sessions" },
  { action: "prevTab", label: "Previous session", hint: "Cycle backward through open sessions" },
  { action: "startProject", label: "Start project", hint: "Runs every auto-start item" },
  { action: "stopAllSessions", label: "Stop all sessions", hint: "Kills every session in the project" },
  { action: "openAppSettings", label: "App settings", hint: "Open these settings" },
  { action: "openProjectSettings", label: "Project settings", hint: "Edit the active project" },
  { action: "focusSearch", label: "Focus search", hint: "Jump to the sidebar search field" },
];

export type AppSettings = {
  theme: ThemeMode;
  appFontFamily: string;
  /** Webview zoom factor applied to the whole interface. */
  uiScale: number;
  /** Fallback shell for Terminal items left blank. Undefined => OS default ($SHELL/COMSPEC). */
  defaultShell?: string;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalLineHeight: number;
  terminalScrollback: number;
  /** Id of a profile in src/lib/colorProfiles.ts. */
  terminalColorProfile: string;
  terminalCursorStyle: CursorStyle;
  terminalCursorBlink: boolean;
  confirmBeforeDelete: boolean;
  keybindings: Keybindings;
};

export const SYSTEM_UI_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';

export const defaultAppSettings: AppSettings = {
  theme: "system",
  appFontFamily: SYSTEM_UI_FONT,
  uiScale: 1,
  defaultShell: undefined,
  terminalFontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
  terminalFontSize: 13,
  terminalLineHeight: 1.2,
  terminalScrollback: 2000,
  terminalColorProfile: "manager-dark",
  terminalCursorStyle: "bar",
  terminalCursorBlink: true,
  confirmBeforeDelete: true,
  keybindings: defaultKeybindings,
};

export const TERMINAL_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', Menlo, Consolas, monospace" },
  { label: "Menlo", value: "Menlo, Consolas, monospace" },
  { label: "Fira Code", value: "'Fira Code', Menlo, monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', Menlo, monospace" },
  { label: "SF Mono", value: "'SF Mono', Menlo, monospace" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', Menlo, monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', Menlo, monospace" },
  { label: "Consolas", value: "Consolas, Menlo, monospace" },
];

export const UI_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "System default", value: SYSTEM_UI_FONT },
  { label: "Inter", value: 'Inter, -apple-system, "Segoe UI", sans-serif' },
  { label: "Helvetica Neue", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Segoe UI", value: '"Segoe UI", -apple-system, sans-serif' },
  { label: "Roboto", value: 'Roboto, -apple-system, "Segoe UI", sans-serif' },
  { label: "IBM Plex Sans", value: '"IBM Plex Sans", -apple-system, sans-serif' },
];

export const UI_SCALE_OPTIONS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

export type Config = {
  version: 1;
  settings: AppSettings;
  projects: Project[];
};

export const emptyConfig: Config = { version: 1, settings: defaultAppSettings, projects: [] };

export function itemsForGroup(project: Project, group: ItemGroup): Runnable[] {
  return project[group];
}
