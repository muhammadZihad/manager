// Global app shortcuts. Deliberately uses Shift+T / Shift+W (not bare
// Ctrl/Cmd+T / +W) for the tab actions — plain Ctrl+T and Ctrl+W are real
// shell bindings (transpose-chars, delete-word-backward) that would otherwise
// leak through to whatever's running in the focused terminal. This mirrors
// how Windows Terminal handles the same conflict.

import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        const { activeProjectId, quickTerminal } = useStore.getState();
        if (activeProjectId) quickTerminal(activeProjectId);
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        const { activeTabItemId, closeTab } = useStore.getState();
        if (activeTabItemId) closeTab(activeTabItemId);
        return;
      }

      if (!e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const { config, selectProject } = useStore.getState();
        const project = config.projects[Number(e.key) - 1];
        if (project) selectProject(project.id);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
