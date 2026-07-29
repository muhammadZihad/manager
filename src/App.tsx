import { useEffect } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TerminalGrid } from "./components/TerminalGrid";
import { SettingsView } from "./components/SettingsView";
import { AppSettingsView } from "./components/AppSettingsView";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import "./styles/theme.css";

export default function App() {
  const hydrate = useStore((s) => s.hydrate);
  const loaded = useStore((s) => s.loaded);
  const config = useStore((s) => s.config);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const view = useStore((s) => s.view);

  useKeyboardShortcuts();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const root = document.documentElement;
    if (config.settings.theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = config.settings.theme;
    }
  }, [config.settings.theme]);

  const activeProject = config.projects.find((p) => p.id === activeProjectId) ?? null;

  if (!loaded) {
    return (
      <div className="app app--loading">
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="app__main">
        {view === "app-settings" ? (
          <AppSettingsView />
        ) : view === "settings" && activeProject ? (
          <SettingsView project={activeProject} />
        ) : (
          <TerminalGrid />
        )}
      </main>
    </div>
  );
}
