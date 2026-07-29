// Project settings: edit the project's name/directory, and CRUD each item in
// its three groups (name, command, cwd, env, autoStart; agents also get a
// provider select; terminals also get a shell quick-pick). Edits commit
// straight to the store, which debounces the actual disk write — no separate
// Save button, matching a live-editing host-config feel.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, Plus, Trash2, Upload } from "lucide-react";
import { useStore } from "../store";
import { pickDirectory } from "../lib/dialog";
import { listShells } from "../lib/shell";
import { exportProjectsToFile } from "../lib/transfer";
import { ImportPanel } from "./ImportPanel";
import type { ImportCandidate } from "../lib/import";
import type { Agent, ItemGroup, Project, Runnable } from "../types";

const GROUP_META: { key: ItemGroup; label: string; hint: string }[] = [
  { key: "commands", label: "Commands", hint: "e.g. npm run dev" },
  { key: "agents", label: "Agents", hint: "e.g. claude, codex" },
  { key: "terminals", label: "Terminals", hint: "defaults to your shell" },
];

export function SettingsView({ project }: { project: Project }) {
  const updateProject = useStore((s) => s.updateProject);
  const removeProject = useStore((s) => s.removeProject);
  const addItem = useStore((s) => s.addItem);
  const confirmBeforeDelete = useStore((s) => s.config.settings.confirmBeforeDelete);
  const focusItemId = useStore((s) => s.focusItemId);
  const setFocusItem = useStore((s) => s.setFocusItem);
  const [importOpen, setImportOpen] = useState(false);

  function handleImport(candidates: ImportCandidate[]) {
    candidates.forEach((c) => addItem(project.id, "commands", { name: c.name, command: c.command }));
    setImportOpen(false);
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1>{project.name}</h1>
        <span className="settings-view__subtitle">Project settings</span>
      </header>

      <section className="settings-section">
        <label className="field">
          <span>Project name</span>
          <input value={project.name} onChange={(e) => updateProject(project.id, { name: e.target.value })} />
        </label>
        <label className="field">
          <span>Project directory</span>
          <div className="field__with-button">
            <input
              value={project.directory}
              onChange={(e) => updateProject(project.id, { directory: e.target.value })}
            />
            <button
              type="button"
              onClick={async () => {
                const picked = await pickDirectory(project.directory);
                if (picked) updateProject(project.id, { directory: picked });
              }}
            >
              Browse…
            </button>
          </div>
        </label>
        <div className="settings-section__actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => exportProjectsToFile([project], project.name)}
          >
            <FileDown size={14} /> Export Project
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (!confirmBeforeDelete || confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                removeProject(project.id);
              }
            }}
          >
            Delete project
          </button>
        </div>
      </section>

      {GROUP_META.map((meta) => (
        <section className="settings-section" key={meta.key}>
          <div className="settings-section__header">
            <h2>{meta.label}</h2>
            <div className="settings-section__header-actions">
              {meta.key === "commands" && (
                <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
                  <Upload size={14} /> Import…
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  addItem(project.id, meta.key, {
                    name: `New ${meta.label.slice(0, -1).toLowerCase()}`,
                  })
                }
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <p className="settings-section__hint">{meta.hint}</p>
          <div className="settings-section__items">
            {project[meta.key].map((item) => (
              <ItemEditor
                key={item.id}
                project={project}
                group={meta.key}
                item={item}
                focusId={focusItemId}
                onFocused={() => setFocusItem(null)}
                confirmBeforeDelete={confirmBeforeDelete}
              />
            ))}
            {project[meta.key].length === 0 && (
              <div className="settings-section__empty">Nothing here yet.</div>
            )}
          </div>
        </section>
      ))}

      {importOpen && (
        <ImportPanel directory={project.directory} onImport={handleImport} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

function ItemEditor({
  project,
  group,
  item,
  focusId,
  onFocused,
  confirmBeforeDelete,
}: {
  project: Project;
  group: ItemGroup;
  item: Runnable | Agent;
  focusId: string | null;
  onFocused: () => void;
  confirmBeforeDelete: boolean;
}) {
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const [expanded, setExpanded] = useState(false);
  const [shells, setShells] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId === item.id) {
      setExpanded(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      onFocused();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, item.id]);

  useEffect(() => {
    if (group === "terminals" && expanded && shells.length === 0) {
      listShells()
        .then(setShells)
        .catch(() => setShells([]));
    }
  }, [group, expanded, shells.length]);

  function patch(p: Partial<Runnable> & { provider?: Agent["provider"] }) {
    updateItem(project.id, group, item.id, p);
  }

  function updateEnvKey(oldKey: string, newKey: string, value: string) {
    const env = { ...item.env };
    delete env[oldKey];
    if (newKey) env[newKey] = value;
    patch({ env });
  }
  function updateEnvValue(key: string, value: string) {
    patch({ env: { ...item.env, [key]: value } });
  }
  function addEnvRow() {
    patch({ env: { ...item.env, "": "" } });
  }
  function removeEnvRow(key: string) {
    const env = { ...item.env };
    delete env[key];
    patch({ env });
  }

  function handleDelete() {
    if (!confirmBeforeDelete || confirm(`Delete "${item.name}"?`)) {
      removeItem(project.id, group, item.id);
    }
  }

  return (
    <div className="item-editor" ref={rootRef}>
      <div className="item-editor__header" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="item-editor__name">{item.name || "Untitled"}</span>
        <span className="item-editor__summary">{item.command ?? "(default shell)"}</span>
        <label className="item-editor__autostart" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={item.autoStart}
            onChange={(e) => patch({ autoStart: e.target.checked })}
          />
          Auto-start
        </label>
        <button
          type="button"
          className="item-editor__delete"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="item-editor__body">
          <label className="field">
            <span>Name</span>
            <input value={item.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>

          {group === "agents" && (
            <label className="field">
              <span>Provider</span>
              <select
                value={(item as Agent).provider ?? "custom"}
                onChange={(e) => patch({ provider: e.target.value as Agent["provider"] })}
              >
                <option value="claude">claude</option>
                <option value="codex">codex</option>
                <option value="custom">custom</option>
              </select>
            </label>
          )}

          {group === "terminals" && (
            <label className="field">
              <span>Shell</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) patch({ command: e.target.value });
                }}
              >
                <option value="">Quick pick a shell…</option>
                {shells.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Command {group === "terminals" && "(blank = default shell)"}</span>
            <input
              value={item.command ?? ""}
              placeholder={group === "terminals" ? "(default shell)" : "e.g. npm run dev, claude"}
              onChange={(e) => patch({ command: e.target.value || undefined })}
            />
          </label>

          <label className="field">
            <span>Working directory</span>
            <div className="field__with-button">
              <input
                value={item.cwd ?? ""}
                placeholder={project.directory}
                onChange={(e) => patch({ cwd: e.target.value || undefined })}
              />
              <button
                type="button"
                onClick={async () => {
                  const picked = await pickDirectory(item.cwd || project.directory);
                  if (picked) patch({ cwd: picked });
                }}
              >
                Browse…
              </button>
            </div>
          </label>

          <div className="field">
            <span>Environment variables</span>
            <div className="env-editor">
              {Object.entries(item.env).map(([key, value], idx) => (
                <div className="env-editor__row" key={`${key}-${idx}`}>
                  <input
                    placeholder="KEY"
                    defaultValue={key}
                    onBlur={(e) => updateEnvKey(key, e.target.value, value)}
                  />
                  <input
                    placeholder="value"
                    value={value}
                    onChange={(e) => updateEnvValue(key, e.target.value)}
                  />
                  <button type="button" onClick={() => removeEnvRow(key)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={addEnvRow}>
                <Plus size={12} /> Add variable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
