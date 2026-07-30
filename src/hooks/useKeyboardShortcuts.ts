// Global app shortcuts, driven by the user's configured keybindings.
//
// Every chord the app claims is a chord the focused terminal never receives,
// so the defaults stay off keys the shell needs (see defaultKeybindings and
// the RESERVED list in lib/keys.ts).
//
// Project switching (Mod+1…9) is handled here but isn't rebindable — it's a
// range of nine bindings rather than a single chord.

import { useEffect } from "react";
import { useStore } from "../store";
import { matchesCombo } from "../lib/keys";
import type { KeybindingAction } from "../types";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Cheap bail-out: every binding requires at least one modifier, so plain
      // typing into a terminal never walks the binding table.
      if (!e.metaKey && !e.ctrlKey && !e.altKey) return;

      const state = useStore.getState();
      const { keybindings } = state.config.settings;

      const run: Record<KeybindingAction, () => void> = {
        newTerminal: () => {
          if (state.activeProjectId) state.quickTerminal(state.activeProjectId);
        },
        closeTab: () => {
          if (state.activeTabItemId) state.closeTab(state.activeTabItemId);
        },
        nextTab: () => state.cycleTab(1),
        prevTab: () => state.cycleTab(-1),
        startProject: () => {
          if (state.activeProjectId) state.startProject(state.activeProjectId);
        },
        stopAllSessions: () => {
          if (state.activeProjectId) state.stopProject(state.activeProjectId);
        },
        openAppSettings: () => state.setView("app-settings"),
        openProjectSettings: () => {
          if (state.activeProjectId) state.setView("settings");
        },
        focusSearch: () => {
          const input = document.getElementById("sidebar-search") as HTMLInputElement | null;
          input?.focus();
          input?.select();
        },
      };

      for (const [action, combo] of Object.entries(keybindings)) {
        if (matchesCombo(e, combo)) {
          e.preventDefault();
          run[action as KeybindingAction]?.();
          return;
        }
      }

      // Fixed: Mod+1…9 jumps to the n-th project.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && /^Digit[1-9]$/.test(e.code)) {
        e.preventDefault();
        const project = state.config.projects[Number(e.code.slice(5)) - 1];
        if (project) state.selectProject(project.id);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
