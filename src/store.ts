// App-wide state: the persisted Config (projects/items) plus the in-memory
// "what's currently running" registry (open terminal tabs and their status).
//
// PTY spawning itself happens inside the Terminal component (it owns the
// xterm.js instance that the session's output streams into) — this store just
// tracks *which* items are open/running so the Sidebar and TerminalGrid can
// reflect it, and owns all Config CRUD + debounced autosave to disk.

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { AppSettings, Agent, Config, ItemGroup, Project, Runnable } from "./types";
import { defaultAppSettings, emptyConfig } from "./types";
import { loadConfig, saveConfig } from "./lib/config";
import { killSession } from "./lib/pty";

export type TabStatus = "starting" | "running" | "exited";

export type Tab = {
  /** Changes every (re)start; TerminalGrid keys the xterm instance on this
   *  so restarting an item always gets a fresh terminal, not stale scrollback. */
  runId: string;
  itemId: string;
  projectId: string;
  group: ItemGroup;
  name: string;
  sessionId: string | null; // set once spawn_session resolves
  status: TabStatus;
  exitCode: number | null;
};

type View = "terminals" | "settings" | "app-settings";

type StoreState = {
  config: Config;
  loaded: boolean;
  activeProjectId: string | null;
  view: View;
  tabs: Tab[];
  activeTabItemId: string | null;
  /** Set by the sidebar's "Edit" context-menu action; SettingsView expands +
   *  scrolls to this item once, then clears it. */
  focusItemId: string | null;

  hydrate: () => Promise<void>;

  addProject: (name: string, directory: string) => string;
  updateProject: (id: string, patch: Partial<Omit<Project, "id" | "commands" | "terminals" | "agents">>) => void;
  removeProject: (id: string) => void;
  selectProject: (id: string) => void;
  setView: (view: View) => void;
  setFocusItem: (itemId: string | null) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  addItem: (projectId: string, group: ItemGroup, item: Partial<Runnable> & { provider?: Agent["provider"] }) => string;
  updateItem: (projectId: string, group: ItemGroup, itemId: string, patch: Partial<Runnable> & { provider?: Agent["provider"] }) => void;
  removeItem: (projectId: string, group: ItemGroup, itemId: string) => void;
  importProjects: (projects: Project[]) => number;

  openTab: (projectId: string, group: ItemGroup, item: Runnable) => void;
  quickTerminal: (projectId: string) => void;
  setActiveTab: (itemId: string) => void;
  setTabSession: (itemId: string, sessionId: string) => void;
  setTabExited: (itemId: string, code: number | null) => void;
  closeTab: (itemId: string) => void;

  startProject: (projectId: string) => void;
  stopProject: (projectId: string) => void;
  stopItem: (itemId: string) => void;
};

function regenerateProjectIds(project: Project): Project {
  const remap = <T extends Runnable>(items: T[]): T[] => items.map((it) => ({ ...it, id: uuid() }));
  return {
    ...project,
    id: uuid(),
    commands: remap(project.commands),
    agents: remap(project.agents),
    terminals: remap(project.terminals),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(config: Config) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveConfig(config).catch((e) => console.error("Failed to save config", e));
  }, 300);
}

function newRunnable(item: Partial<Runnable>): Runnable {
  return {
    id: uuid(),
    name: item.name ?? "New item",
    command: item.command,
    cwd: item.cwd,
    env: item.env ?? {},
    autoStart: item.autoStart ?? true,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  config: emptyConfig,
  loaded: false,
  activeProjectId: null,
  view: "terminals",
  tabs: [],
  activeTabItemId: null,
  focusItemId: null,

  hydrate: async () => {
    // Old projects.json files predate the `settings` key (and any settings
    // added since), so merge over defaults rather than trusting the loaded
    // shape to be complete.
    const raw = (await loadConfig()) as Partial<Config>;
    const config: Config = {
      version: 1,
      settings: { ...defaultAppSettings, ...raw.settings },
      projects: raw.projects ?? [],
    };
    set({
      config,
      loaded: true,
      activeProjectId: config.projects[0]?.id ?? null,
    });
  },

  addProject: (name, directory) => {
    const project: Project = { id: uuid(), name, directory, commands: [], terminals: [], agents: [] };
    const config = { ...get().config, projects: [...get().config.projects, project] };
    set({ config, activeProjectId: project.id });
    scheduleSave(config);
    return project.id;
  },

  updateProject: (id, patch) => {
    const config = {
      ...get().config,
      projects: get().config.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    set({ config });
    scheduleSave(config);
  },

  removeProject: (id) => {
    const config = { ...get().config, projects: get().config.projects.filter((p) => p.id !== id) };
    const activeProjectId = get().activeProjectId === id ? config.projects[0]?.id ?? null : get().activeProjectId;
    set({ config, activeProjectId });
    scheduleSave(config);
  },

  selectProject: (id) => {
    // If the currently active tab doesn't belong to the project being
    // selected, fall back to that project's most recently opened tab (if
    // any) so switching projects shows relevant content — without touching
    // any other project's tabs, which keep running in the background.
    const tabsForProject = get().tabs.filter((t) => t.projectId === id);
    const activeBelongsToProject = tabsForProject.some((t) => t.itemId === get().activeTabItemId);
    set({
      activeProjectId: id,
      view: "terminals",
      activeTabItemId: activeBelongsToProject
        ? get().activeTabItemId
        : tabsForProject[tabsForProject.length - 1]?.itemId ?? null,
    });
  },
  setView: (view) => set({ view }),
  setFocusItem: (itemId) => set({ focusItemId: itemId }),

  updateSettings: (patch) => {
    const config = { ...get().config, settings: { ...get().config.settings, ...patch } };
    set({ config });
    scheduleSave(config);
  },

  addItem: (projectId, group, item) => {
    const runnable: Runnable = newRunnable(item);
    const withProvider = group === "agents" ? { ...runnable, provider: item.provider ?? "custom" } : runnable;
    const config = {
      ...get().config,
      projects: get().config.projects.map((p) =>
        p.id === projectId ? { ...p, [group]: [...p[group], withProvider] } : p,
      ),
    };
    set({ config });
    scheduleSave(config);
    return runnable.id;
  },

  updateItem: (projectId, group, itemId, patch) => {
    const config = {
      ...get().config,
      projects: get().config.projects.map((p) =>
        p.id === projectId
          ? { ...p, [group]: p[group].map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
          : p,
      ),
    };
    set({ config });
    scheduleSave(config);
  },

  removeItem: (projectId, group, itemId) => {
    const config = {
      ...get().config,
      projects: get().config.projects.map((p) =>
        p.id === projectId ? { ...p, [group]: p[group].filter((it) => it.id !== itemId) } : p,
      ),
    };
    set({ config });
    scheduleSave(config);
    get().closeTab(itemId);
  },

  importProjects: (projects) => {
    const regenerated = projects.map(regenerateProjectIds);
    const config = { ...get().config, projects: [...get().config.projects, ...regenerated] };
    set({ config });
    scheduleSave(config);
    return regenerated.length;
  },

  openTab: (projectId, group, item) => {
    const tabs = get().tabs.filter((t) => t.itemId !== item.id);
    const tab: Tab = {
      runId: uuid(),
      itemId: item.id,
      projectId,
      group,
      name: item.name,
      sessionId: null,
      status: "starting",
      exitCode: null,
    };
    set({ tabs: [...tabs, tab], activeTabItemId: item.id, view: "terminals" });
  },

  quickTerminal: (projectId) => {
    const itemId = get().addItem(projectId, "terminals", { name: "Terminal", autoStart: false });
    const project = get().config.projects.find((p) => p.id === projectId);
    const item = project?.terminals.find((t) => t.id === itemId);
    if (item) get().openTab(projectId, "terminals", item);
  },

  setActiveTab: (itemId) => set({ activeTabItemId: itemId, view: "terminals" }),

  setTabSession: (itemId, sessionId) =>
    set({
      tabs: get().tabs.map((t) => (t.itemId === itemId ? { ...t, sessionId, status: "running" } : t)),
    }),

  setTabExited: (itemId, code) =>
    set({
      tabs: get().tabs.map((t) => (t.itemId === itemId ? { ...t, status: "exited", exitCode: code } : t)),
    }),

  closeTab: (itemId) => {
    const tab = get().tabs.find((t) => t.itemId === itemId);
    if (tab?.sessionId && tab.status === "running") {
      killSession(tab.sessionId).catch(() => {});
    }
    const tabs = get().tabs.filter((t) => t.itemId !== itemId);
    const activeTabItemId = get().activeTabItemId === itemId ? tabs[tabs.length - 1]?.itemId ?? null : get().activeTabItemId;
    set({ tabs, activeTabItemId });
  },

  startProject: (projectId) => {
    const project = get().config.projects.find((p) => p.id === projectId);
    if (!project) return;
    (["commands", "agents", "terminals"] as ItemGroup[]).forEach((group) => {
      project[group].filter((item) => item.autoStart).forEach((item) => get().openTab(projectId, group, item));
    });
  },

  stopProject: (projectId) => {
    get()
      .tabs.filter((t) => t.projectId === projectId && t.status === "running" && t.sessionId)
      .forEach((t) => killSession(t.sessionId!).catch(() => {}));
  },

  stopItem: (itemId) => {
    const tab = get().tabs.find((t) => t.itemId === itemId);
    if (tab?.sessionId && tab.status === "running") {
      killSession(tab.sessionId).catch(() => {});
    }
  },
}));
