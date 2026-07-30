// Global, app-wide preferences (as opposed to SettingsView, which is
// per-project). Split into sections rather than one long scroll, since this now
// covers appearance, terminal rendering, keybindings and data.

import { useEffect, useMemo, useState } from "react";
import { Keyboard, Monitor, Palette, Database } from "lucide-react";
import { useStore } from "../store";
import {
  KEYBINDING_META,
  TERMINAL_FONT_OPTIONS,
  UI_FONT_OPTIONS,
  UI_SCALE_OPTIONS,
  defaultKeybindings,
  type CursorStyle,
  type KeybindingAction,
  type ThemeMode,
} from "../types";
import { COLOR_PROFILES, profileSwatch } from "../lib/colorProfiles";
import { findConflicts, formatCombo } from "../lib/keys";
import { listShells } from "../lib/shell";
import { exportProjectsToFile, importProjectsFromFile } from "../lib/transfer";
import { TerminalPreview } from "./TerminalPreview";
import { KeybindingRow } from "./KeybindingRow";

type Section = "appearance" | "terminal" | "keybindings" | "data";

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "terminal", label: "Terminal", icon: Monitor },
  { id: "keybindings", label: "Keybindings", icon: Keyboard },
  { id: "data", label: "Data", icon: Database },
];

export function AppSettingsView() {
  const settings = useStore((s) => s.config.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const projects = useStore((s) => s.config.projects);
  const importProjects = useStore((s) => s.importProjects);

  const [section, setSection] = useState<Section>("appearance");
  const [shells, setShells] = useState<string[]>([]);
  const [dataMessage, setDataMessage] = useState<string | null>(null);

  useEffect(() => {
    listShells()
      .then(setShells)
      .catch(() => setShells([]));
  }, []);

  const conflicts = useMemo(() => findConflicts(settings.keybindings), [settings.keybindings]);

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

  function setBinding(action: KeybindingAction, combo: string) {
    updateSettings({ keybindings: { ...settings.keybindings, [action]: combo } });
  }

  return (
    <div className="settings-view settings-view--tabbed">
      <header className="settings-view__header">
        <h1>App Settings</h1>
        <span className="settings-view__subtitle">Applies across all projects</span>
      </header>

      <nav className="settings-tabs">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              className={`settings-tabs__tab${section === s.id ? " settings-tabs__tab--active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <Icon size={14} strokeWidth={1.9} />
              {s.label}
            </button>
          );
        })}
      </nav>

      {section === "appearance" && (
        <>
          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Theme</h2>
            </div>
            <div className="theme-picker">
              {(["dark", "light", "system"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`theme-card${settings.theme === mode ? " theme-card--active" : ""}`}
                  onClick={() => updateSettings({ theme: mode })}
                >
                  <span className={`theme-card__swatch theme-card__swatch--${mode}`} />
                  <span className="theme-card__label">
                    {mode === "system" ? "Match system" : mode === "dark" ? "Dark" : "Light"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Interface font</h2>
            </div>
            <label className="field">
              <span>Font family</span>
              <select
                value={settings.appFontFamily}
                onChange={(e) => updateSettings({ appFontFamily: e.target.value })}
              >
                {UI_FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="settings-section__hint" style={{ fontFamily: settings.appFontFamily }}>
              The quick brown fox jumps over the lazy dog — 0123456789
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Interface scale</h2>
            </div>
            <p className="settings-section__hint">
              Zooms the whole window, including terminals. Terminal font size below is applied on top
              of this.
            </p>
            <div className="scale-picker">
              {UI_SCALE_OPTIONS.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={`scale-chip${settings.uiScale === scale ? " scale-chip--active" : ""}`}
                  onClick={() => updateSettings({ uiScale: scale })}
                >
                  {Math.round(scale * 100)}%
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {section === "terminal" && (
        <>
          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Default shell</h2>
            </div>
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
            {shells.length === 0 && (
              <p className="settings-section__hint">
                Couldn't read the installed shell list — you can still type a shell into any
                Terminal item's Command field.
              </p>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Colour profile</h2>
            </div>
            <div className="profile-grid">
              {COLOR_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`profile-card${
                    settings.terminalColorProfile === profile.id ? " profile-card--active" : ""
                  }`}
                  onClick={() => updateSettings({ terminalColorProfile: profile.id })}
                  style={{ background: profile.theme.background }}
                >
                  <span className="profile-card__name" style={{ color: profile.theme.foreground }}>
                    {profile.name}
                  </span>
                  <span className="profile-card__swatch">
                    {profileSwatch(profile).map((c, i) => (
                      <i key={i} style={{ background: c }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Text</h2>
            </div>
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
              <span>Font size — {settings.terminalFontSize}px</span>
              <input
                type="range"
                min={9}
                max={24}
                value={settings.terminalFontSize}
                onChange={(e) => updateSettings({ terminalFontSize: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Line height — {settings.terminalLineHeight.toFixed(2)}</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.05}
                value={settings.terminalLineHeight}
                onChange={(e) => updateSettings({ terminalLineHeight: Number(e.target.value) })}
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
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Cursor</h2>
            </div>
            <label className="field">
              <span>Style</span>
              <select
                value={settings.terminalCursorStyle}
                onChange={(e) => updateSettings({ terminalCursorStyle: e.target.value as CursorStyle })}
              >
                <option value="bar">Bar</option>
                <option value="block">Block</option>
                <option value="underline">Underline</option>
              </select>
            </label>
            <label className="item-editor__autostart" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={settings.terminalCursorBlink}
                onChange={(e) => updateSettings({ terminalCursorBlink: e.target.checked })}
              />
              Blink the cursor
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Preview</h2>
            </div>
            <p className="settings-section__hint">
              A real terminal rendering sample output with the settings above. Changes apply to newly
              opened sessions — already-running ones keep their current look until restarted.
            </p>
            <TerminalPreview
              fontFamily={settings.terminalFontFamily}
              fontSize={settings.terminalFontSize}
              lineHeight={settings.terminalLineHeight}
              colorProfile={settings.terminalColorProfile}
              cursorStyle={settings.terminalCursorStyle}
              cursorBlink={settings.terminalCursorBlink}
            />
          </section>
        </>
      )}

      {section === "keybindings" && (
        <>
          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Shortcuts</h2>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => updateSettings({ keybindings: { ...defaultKeybindings } })}
              >
                Reset all
              </button>
            </div>
            <p className="settings-section__hint">
              Click a shortcut and press the keys you want. Esc cancels, Backspace unassigns. Every
              shortcut needs a Cmd/Ctrl or Alt modifier — and anything the app claims is a key your
              shell will never receive, so chords the shell needs (like {formatCombo("Mod+C")} or{" "}
              {formatCombo("Mod+K")}) are refused.
            </p>

            {conflicts.size > 0 && (
              <p className="settings-section__warning">
                Two actions share the same shortcut. The one listed first will win.
              </p>
            )}

            <div className="keybind-list">
              {KEYBINDING_META.map((meta) => (
                <KeybindingRow
                  key={meta.action}
                  label={meta.label}
                  hint={meta.hint}
                  combo={settings.keybindings[meta.action] ?? ""}
                  isDefault={settings.keybindings[meta.action] === defaultKeybindings[meta.action]}
                  conflicting={conflicts.has(settings.keybindings[meta.action] ?? "")}
                  onChange={(combo) => setBinding(meta.action, combo)}
                  onReset={() => setBinding(meta.action, defaultKeybindings[meta.action])}
                />
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Fixed shortcuts</h2>
            </div>
            <div className="keybind-row keybind-row--static">
              <div className="keybind-row__text">
                <span className="keybind-row__label">Jump to project 1–9</span>
                <span className="keybind-row__hint">Selects the n-th project in the sidebar</span>
              </div>
              <span className="keybind-row__combo keybind-row__combo--static">
                {formatCombo("Mod+1")} … {formatCombo("Mod+9")}
              </span>
            </div>
          </section>
        </>
      )}

      {section === "data" && (
        <>
          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Export &amp; import</h2>
            </div>
            <p className="settings-section__hint">
              Export for backup or to move to another machine. Import adds projects from a file — it
              never overwrites what's already here.
            </p>
            <div className="settings-section__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleExportAll}
                disabled={projects.length === 0}
              >
                Export All Projects
              </button>
              <button type="button" className="btn-ghost" onClick={handleImport}>
                Import Projects…
              </button>
            </div>
            {dataMessage && <p className="settings-section__hint">{dataMessage}</p>}
          </section>

          <section className="settings-section">
            <div className="settings-section__header">
              <h2>Safety</h2>
            </div>
            <label className="item-editor__autostart" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={settings.confirmBeforeDelete}
                onChange={(e) => updateSettings({ confirmBeforeDelete: e.target.checked })}
              />
              Ask for confirmation before deleting projects or items
            </label>
          </section>
        </>
      )}
    </div>
  );
}
