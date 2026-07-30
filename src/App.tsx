import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TerminalGrid } from "./components/TerminalGrid";
import { SettingsView } from "./components/SettingsView";
import { AppSettingsView } from "./components/AppSettingsView";
import { AppContextMenu } from "./components/AppContextMenu";
import { StatusFooter } from "./components/StatusFooter";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSessionPorts } from "./hooks/useSessionPorts";
import { getColorProfile } from "./lib/colorProfiles";
import "./styles/theme.css";

export default function App() {
  const hydrate = useStore((s) => s.hydrate);
  const loaded = useStore((s) => s.loaded);
  const config = useStore((s) => s.config);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const view = useStore((s) => s.view);
  const { theme, appFontFamily, uiScale, terminalColorProfile } = config.settings;

  useKeyboardShortcuts();
  useSessionPorts();

  useEffect(() => {
    hydrate();
  }, [hydrate]);


  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }

    // The title bar is native OS chrome, so CSS can't reach it — the window has
    // to be told which appearance to draw. Passing null hands it back to the
    // system setting, which is what "Match system" should do.
    getCurrentWindow()
      .setTheme(theme === "system" ? null : theme)
      .catch(() => {
        // Not fatal — only the window frame stays on the system appearance.
      });
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-ui", appFontFamily);
  }, [appFontFamily]);

  // Native webview zoom rather than a CSS transform: it reflows layout the way
  // browser zoom does, so nothing is left overflowing or blurry.
  useEffect(() => {
    getCurrentWebview()
      .setZoom(uiScale)
      .catch(() => {
        // Not fatal — the app is simply left at 100%.
      });
  }, [uiScale]);

  // Keep the area around the terminal matching the profile, so a light palette
  // isn't framed by a dark box.
  useEffect(() => {
    const { background } = getColorProfile(terminalColorProfile).theme;
    document.documentElement.style.setProperty("--terminal-bg", background);
  }, [terminalColorProfile]);

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
          <>
            <TerminalGrid />
            <StatusFooter />
          </>
        )}
      </main>
      {/* Owns right-click for the whole window, including suppressing the
          WebView's native menu. */}
      <AppContextMenu />
    </div>
  );
}
