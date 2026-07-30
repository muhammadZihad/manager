// The app's single right-click menu. Mounted once; it listens for contextmenu
// on the window, works out what was clicked, and builds the appropriate menu.
//
// Regions identify themselves with a `data-ctx` attribute plus whatever ids the
// actions need, so this file resolves a target with one closest() call rather
// than every component wiring up its own handler and menu instance.

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardPaste,
  Copy,
  Eraser,
  FileDown,
  FolderPlus,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Settings,
  Square,
  SquareTerminal,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { ContextMenu, type ContextMenuEntry } from "./ContextMenu";
import { copyToClipboard, inputSelection, insertTextAtCaret, readClipboard } from "../lib/clipboard";
import { getTerminal } from "../lib/terminals";
import { exportProjectsToFile } from "../lib/transfer";
import { writeToRun } from "../lib/session";
import type { ItemGroup } from "../types";

type Anchor = { x: number; y: number; items: ContextMenuEntry[] };

const GROUP_SINGULAR: Record<ItemGroup, string> = {
  commands: "command",
  agents: "agent",
  terminals: "terminal",
};

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";

export function AppContextMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const build = useCallback((e: MouseEvent): ContextMenuEntry[] => {
    const target = e.target as HTMLElement | null;
    if (!target) return [];

    // 1. Editable fields get clipboard actions. Checked first: an input inside
    //    a data-ctx region should still behave like a text field.
    const field = target.closest("input, textarea, [contenteditable='true']") as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (field && !(field instanceof HTMLInputElement && ["checkbox", "radio", "range"].includes(field.type))) {
      return textFieldMenu(field);
    }

    const region = target.closest("[data-ctx]") as HTMLElement | null;
    switch (region?.dataset.ctx) {
      case "terminal":
        return terminalMenu(region);
      case "item":
        return itemMenu(region);
      case "project":
        return projectMenu(region);
      case "group":
        return groupMenu(region);
      default:
        return defaultMenu();
    }
  }, []);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      // Always suppress the WebView's own menu — the app provides its own.
      e.preventDefault();
      const items = build(e);
      if (items.length === 0) return;
      setAnchor({ x: e.clientX, y: e.clientY, items });
    }
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, [build]);

  if (!anchor) return null;
  return (
    <ContextMenu x={anchor.x} y={anchor.y} items={anchor.items} onClose={() => setAnchor(null)} />
  );
}

/* ------------------------------- text fields ------------------------------ */

function textFieldMenu(field: HTMLInputElement | HTMLTextAreaElement): ContextMenuEntry[] {
  const selection = inputSelection(field);
  const readOnly = field.readOnly || field.disabled;

  return [
    {
      label: "Cut",
      icon: <Scissors size={13} />,
      hint: `${MOD}X`,
      disabled: !selection || readOnly,
      onClick: () => {
        copyToClipboard(selection);
        field.focus();
        // Replacing the selection with nothing deletes it and fires `input`,
        // which keeps React's controlled value in sync.
        insertTextAtCaret("");
      },
    },
    {
      label: "Copy",
      icon: <Copy size={13} />,
      hint: `${MOD}C`,
      disabled: !selection,
      onClick: () => copyToClipboard(selection),
    },
    {
      label: "Paste",
      icon: <ClipboardPaste size={13} />,
      hint: `${MOD}V`,
      disabled: readOnly,
      onClick: async () => {
        const text = await readClipboard();
        field.focus();
        insertTextAtCaret(text);
      },
    },
    { separator: true },
    {
      label: "Select All",
      icon: <TextCursorInput size={13} />,
      hint: `${MOD}A`,
      onClick: () => {
        field.focus();
        field.select();
      },
    },
  ];
}

/* -------------------------------- terminal -------------------------------- */

function terminalMenu(region: HTMLElement): ContextMenuEntry[] {
  const runId = region.dataset.runId ?? "";
  const itemId = region.dataset.itemId ?? "";
  const term = getTerminal(runId);
  const selection = term?.getSelection() ?? "";

  const state = useStore.getState();
  const tab = state.tabs.find((t) => t.itemId === itemId);
  const running = tab?.status === "running";

  return [
    {
      label: "Copy",
      icon: <Copy size={13} />,
      hint: `${MOD}C`,
      disabled: !selection,
      onClick: () => copyToClipboard(selection),
    },
    {
      label: "Paste",
      icon: <ClipboardPaste size={13} />,
      hint: `${MOD}V`,
      disabled: !running,
      onClick: async () => {
        const text = await readClipboard();
        if (text) writeToRun(runId, text);
      },
    },
    { separator: true },
    {
      label: "Select All",
      icon: <TextCursorInput size={13} />,
      onClick: () => term?.selectAll(),
    },
    {
      label: "Clear",
      icon: <Eraser size={13} />,
      onClick: () => term?.clear(),
    },
    { separator: true },
    running
      ? {
          label: "Stop",
          icon: <Square size={13} />,
          onClick: () => state.stopItem(itemId),
        }
      : {
          label: "Restart",
          icon: <RotateCcw size={13} />,
          onClick: () => restartItem(itemId),
        },
    {
      label: "Close session",
      icon: <X size={13} />,
      onClick: () => state.closeTab(itemId),
    },
  ];
}

/* ------------------------------ sidebar item ------------------------------ */

function itemMenu(region: HTMLElement): ContextMenuEntry[] {
  const itemId = region.dataset.itemId ?? "";
  const state = useStore.getState();
  const tab = state.tabs.find((t) => t.itemId === itemId);
  const running = tab?.status === "running";
  const found = findItem(itemId);
  if (!found) return defaultMenu();

  return [
    running
      ? { label: "Stop", icon: <Square size={13} />, onClick: () => state.stopItem(itemId) }
      : {
          label: tab?.status === "exited" ? "Restart" : "Start",
          icon: <Play size={13} />,
          onClick: () => restartItem(itemId),
        },
    {
      label: "Edit",
      icon: <Pencil size={13} />,
      onClick: () => {
        state.selectProject(found.project.id);
        state.setView("settings");
        state.setFocusItem(itemId);
      },
    },
    { separator: true },
    {
      label: "Delete",
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: () => {
        const { confirmBeforeDelete } = state.config.settings;
        if (!confirmBeforeDelete || confirm(`Delete "${found.item.name}"?`)) {
          state.removeItem(found.project.id, found.group, itemId);
        }
      },
    },
  ];
}

/* ------------------------------ project row ------------------------------- */

function projectMenu(region: HTMLElement): ContextMenuEntry[] {
  const projectId = region.dataset.projectId ?? "";
  const state = useStore.getState();
  const project = state.config.projects.find((p) => p.id === projectId);
  if (!project) return defaultMenu();

  const runningCount = state.tabs.filter((t) => t.projectId === projectId && t.status === "running").length;
  const totalItems = project.commands.length + project.agents.length + project.terminals.length;

  return [
    {
      label: "Start project",
      icon: <Play size={13} />,
      disabled: totalItems === 0,
      onClick: () => {
        state.selectProject(projectId);
        state.startProject(projectId);
      },
    },
    {
      label: "Stop all sessions",
      icon: <Square size={13} />,
      disabled: runningCount === 0,
      onClick: () => state.stopProject(projectId),
    },
    { separator: true },
    {
      label: "New terminal",
      icon: <SquareTerminal size={13} />,
      onClick: () => {
        state.selectProject(projectId);
        state.quickTerminal(projectId);
      },
    },
    {
      label: "Project settings",
      icon: <Settings size={13} />,
      onClick: () => {
        state.selectProject(projectId);
        state.setView("settings");
      },
    },
    {
      label: "Export project…",
      icon: <FileDown size={13} />,
      onClick: () => {
        exportProjectsToFile([project], project.name).catch(() => {});
      },
    },
    { separator: true },
    {
      label: "Delete project",
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: () => {
        const { confirmBeforeDelete } = state.config.settings;
        if (!confirmBeforeDelete || confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
          state.removeProject(projectId);
        }
      },
    },
  ];
}

/* ------------------------------ group header ------------------------------ */

function groupMenu(region: HTMLElement): ContextMenuEntry[] {
  const projectId = region.dataset.projectId ?? "";
  const group = (region.dataset.group ?? "commands") as ItemGroup;
  const state = useStore.getState();
  const noun = GROUP_SINGULAR[group];

  const entries: ContextMenuEntry[] = [
    {
      label: `Add ${noun}`,
      icon: <Plus size={13} />,
      onClick: () => {
        const id = state.addItem(projectId, group, {
          name: `New ${noun}`,
          autoStart: group !== "terminals",
        });
        state.selectProject(projectId);
        state.setView("settings");
        state.setFocusItem(id);
      },
    },
  ];

  if (group === "commands") {
    entries.push({
      label: "Import from package.json…",
      icon: <FileDown size={13} />,
      onClick: () => {
        state.selectProject(projectId);
        state.setView("settings");
        state.setImportOpen(true);
      },
    });
  }

  entries.push({ separator: true }, {
    label: "Project settings",
    icon: <Settings size={13} />,
    onClick: () => {
      state.selectProject(projectId);
      state.setView("settings");
    },
  });

  return entries;
}

/* --------------------------------- default -------------------------------- */

function defaultMenu(): ContextMenuEntry[] {
  const state = useStore.getState();
  const projectId = state.activeProjectId;

  const entries: ContextMenuEntry[] = [
    {
      label: "New project",
      icon: <FolderPlus size={13} />,
      onClick: () => state.setAddingProject(true),
    },
  ];

  if (projectId) {
    entries.push({
      label: "New terminal",
      icon: <SquareTerminal size={13} />,
      hint: `${MOD}⇧T`,
      onClick: () => state.quickTerminal(projectId),
    });
  }

  entries.push({ separator: true }, {
    label: "App settings",
    icon: <Settings size={13} />,
    hint: `${MOD},`,
    onClick: () => state.setView("app-settings"),
  });

  return entries;
}

/* --------------------------------- helpers -------------------------------- */

function findItem(itemId: string) {
  const { projects } = useStore.getState().config;
  for (const project of projects) {
    for (const group of ["commands", "agents", "terminals"] as ItemGroup[]) {
      const item = project[group].find((i) => i.id === itemId);
      if (item) return { project, group, item };
    }
  }
  return null;
}

function restartItem(itemId: string) {
  const state = useStore.getState();
  const found = findItem(itemId);
  if (found) state.openTab(found.project.id, found.group, found.item);
}
