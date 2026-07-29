// Global, app-wide preferences (as opposed to SettingsView, which is
// per-project). Reuses SettingsView's .settings-section/.field CSS classes
// so it matches visually without duplicating styles.

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { TERMINAL_FONT_OPTIONS, type ThemeMode } from "../types";
import { listShells } from "../lib/shell";
import { exportProjectsToFile, importProjectsFromFile } from "../lib/transfer";

export function AppSettingsView() {
  const settings = useStore((s) => s.config.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const projects = useStore((s) => s.config.projects);
  const importProjects = useStore((s) => s.importProjects);
  const [shells, setShells] = useState<string[]>([]);
  const [dataMessage, setDataMessage] = useState<string | null>(null);

  useEffect(() => {
    listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, []);

  function flashMessage(text: string) {
    setDataMessage(text);
    setTimeout(() => setDataMessage(null), 3000);
  }

  async function handleExportAll() {
    const exported = await exportProjectsToFile(projects, "manager-projects-backup");
    if (exported) flashMessage(`Exported ${projects.length} project(s).`);
  }

  async function handleImport() {
    const imported = await importProjectsFromFile();
    if (imported) {
      const count = importProjects(imported);
      flashMessage(`Imported ${count} project(s).`);
    }
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1>App Settings</h1>
        <span className="settings-view__subtitle">Applies across all projects</span>
      </header>

      <section className="settings-section">
        <div className="settings-section__header"><h2>Appearance</h2></div>
        <label className="field">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })}
          >
            <option value="system">Match system</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section__header"><h2>Terminal</h2></div>
        <label className="field">
          <span>Font family</span>
          <select
            value={settings.terminalFontFamily}
            onChange={(e) => updateSettings({ terminalFontFamily: e.target.value })}
          >
            {TERMINAL_FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Font size ({settings.terminalFontSize}px)</span>
          <input
            type="range"
            min={10}
            max={20}
            value={settings.terminalFontSize}
            onChange={(e) => updateSettings({ terminalFontSize: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Scrollback (lines)</span>
          <input
            type="number"
            min={100}
            max={50000}
            step={100}
            value={settings.terminalScrollback}
            onChange={(e) => updateSettings({ terminalScrollback: Number(e.target.value) || 0 })}
          />
        </label>
        <p className="settings-section__hint">
          Font and scrollback changes apply to newly opened terminals — already-open ones keep their
          current look until restarted.
        </p>
      </section>

      <section className="settings-section">
        <div className="settings-section__header"><h2>Default shell</h2></div>
        <label className="field">
          <span>Used for Terminal items left blank</span>
          <select
            value={settings.defaultShell ?? ""}
            onChange={(e) => updateSettings({ defaultShell: e.target.value || undefined })}
          >
            <option value="">System default</option>
            {shells.map((sh) => (
              <option key={sh} value={sh}>
                {sh}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section__header"><h2>Safety</h2></div>
        <label className="item-editor__autostart" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.confirmBeforeDelete}
            onChange={(e) => updateSettings({ confirmBeforeDelete: e.target.checked })}
          />
          Ask for confirmation before deleting projects or items
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section__header"><h2>Data</h2></div>
        <p className="settings-section__hint">
          Export for backup or to move to another machine. Import adds projects from a file — it never
          overwrites what's already here.
        </p>
        <div className="settings-section__actions">
          <button type="button" className="btn-ghost" onClick={handleExportAll} disabled={projects.length === 0}>
            Export All Projects
          </button>
          <button type="button" className="btn-ghost" onClick={handleImport}>
            Import Projects…
          </button>
        </div>
        {dataMessage && <p className="settings-section__hint">{dataMessage}</p>}
      </section>
    </div>
  );
}
