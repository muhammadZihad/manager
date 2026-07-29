// Project tree: each project expands into its three groups (Commands, Agents,
// Terminals). Per-item status dots reflect the store's live tab registry;
// per-project Start spawns every autoStart item at once.

import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Play,
  Search,
  Settings,
  SquareTerminal,
  SquareCode,
  Square,
  Trash2,
} from "lucide-react";
import { useStore } from "../store";
import { pickDirectory } from "../lib/dialog";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import type { ItemGroup, Project, Runnable } from "../types";

const GROUPS: { key: ItemGroup; label: string; icon: typeof SquareCode }[] = [
  { key: "commands", label: "Commands", icon: SquareCode },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "terminals", label: "Terminals", icon: SquareTerminal },
];

export function Sidebar() {
  const config = useStore((s) => s.config);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const view = useStore((s) => s.view);
  const addProject = useStore((s) => s.addProject);
  const setView = useStore((s) => s.setView);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingProject, setAddingProject] = useState(false);

  const projects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return config.projects;
    return config.projects.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      return (["commands", "agents", "terminals"] as ItemGroup[]).some((g) =>
        p[g].some((item) => item.name.toLowerCase().includes(q)),
      );
    });
  }, [config.projects, search]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__search">
        <Search size={14} strokeWidth={2} />
        <input
          placeholder="Search projects & items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar__list">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            isExpanded={expanded.has(project.id) || search.trim().length > 0}
            onToggle={() => toggle(project.id)}
          />
        ))}

        {projects.length === 0 && !addingProject && (
          <div className="sidebar__empty">No projects yet — create one to get started.</div>
        )}

        {addingProject ? (
          <NewProjectForm
            onCancel={() => setAddingProject(false)}
            onCreate={(name, dir) => {
              addProject(name, dir);
              setAddingProject(false);
            }}
          />
        ) : (
          <button className="sidebar__add-project" type="button" onClick={() => setAddingProject(true)}>
            <FolderPlus size={15} strokeWidth={2} />
            New Project
          </button>
        )}
      </div>

      <button
        className={`sidebar__app-settings${view === "app-settings" ? " sidebar__app-settings--active" : ""}`}
        type="button"
        onClick={() => setView("app-settings")}
      >
        <Settings size={14} strokeWidth={1.75} />
        App Settings
      </button>
    </aside>
  );
}

function NewProjectForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, directory: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [directory, setDirectory] = useState("");

  return (
    <div className="new-project-form">
      <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="new-project-form__dir">
        <input
          placeholder="Project directory"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
        />
        <button
          type="button"
          onClick={async () => {
            const picked = await pickDirectory();
            if (picked) setDirectory(picked);
          }}
        >
          Browse…
        </button>
      </div>
      <div className="new-project-form__actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-accent"
          disabled={!name.trim() || !directory.trim()}
          onClick={() => onCreate(name.trim(), directory.trim())}
        >
          Create
        </button>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  isActive,
  isExpanded,
  onToggle,
}: {
  project: Project;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const selectProject = useStore((s) => s.selectProject);
  const startProject = useStore((s) => s.startProject);
  const stopProject = useStore((s) => s.stopProject);
  const setView = useStore((s) => s.setView);
  const tabs = useStore((s) => s.tabs);

  const runningCount = tabs.filter((t) => t.projectId === project.id && t.status === "running").length;
  const totalItems = project.commands.length + project.agents.length + project.terminals.length;

  return (
    <div className="project-row">
      <div
        className={`project-row__header${isActive ? " project-row__header--active" : ""}`}
        onClick={() => {
          selectProject(project.id);
          onToggle();
        }}
      >
        <button
          className="project-row__chevron"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="project-row__name">{project.name}</span>
        {runningCount > 0 && <span className="project-row__badge">{runningCount}</span>}
        <button
          className="project-row__icon-btn"
          type="button"
          title="Project settings"
          onClick={(e) => {
            e.stopPropagation();
            selectProject(project.id);
            setView("settings");
          }}
        >
          <Settings size={14} strokeWidth={1.75} />
        </button>
        {runningCount > 0 ? (
          <button
            className="project-row__icon-btn project-row__icon-btn--stop"
            type="button"
            title="Stop all"
            onClick={(e) => {
              e.stopPropagation();
              stopProject(project.id);
            }}
          >
            <Square size={13} strokeWidth={2} />
          </button>
        ) : (
          <button
            className="project-row__icon-btn project-row__icon-btn--play"
            type="button"
            title="Start project"
            disabled={totalItems === 0}
            onClick={(e) => {
              e.stopPropagation();
              selectProject(project.id);
              startProject(project.id);
            }}
          >
            <Play size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="project-row__groups">
          {GROUPS.map((group) => (
            <GroupSection key={group.key} project={project} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  project,
  group,
}: {
  project: Project;
  group: { key: ItemGroup; label: string; icon: typeof SquareCode };
}) {
  const [open, setOpen] = useState(true);
  const items = project[group.key];
  const Icon = group.icon;

  return (
    <div className="group-section">
      <div className="group-section__header" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={13} strokeWidth={1.75} />
        <span>{group.label}</span>
        <span className="group-section__count">{items.length}</span>
      </div>
      {open && (
        <div className="group-section__items">
          {items.length === 0 && <div className="group-section__empty">None yet</div>}
          {items.map((item) => (
            <ItemRow key={item.id} project={project} group={group.key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ project, group, item }: { project: Project; group: ItemGroup; item: Runnable }) {
  const tabs = useStore((s) => s.tabs);
  const activeTabItemId = useStore((s) => s.activeTabItemId);
  const openTab = useStore((s) => s.openTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const stopItem = useStore((s) => s.stopItem);
  const removeItem = useStore((s) => s.removeItem);
  const selectProject = useStore((s) => s.selectProject);
  const setView = useStore((s) => s.setView);
  const setFocusItem = useStore((s) => s.setFocusItem);
  const confirmBeforeDelete = useStore((s) => s.config.settings.confirmBeforeDelete);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const tab = tabs.find((t) => t.itemId === item.id);
  const status = tab?.status ?? "idle";
  const isActiveTab = item.id === activeTabItemId;

  function handleRowClick() {
    selectProject(project.id);
    if (tab) {
      setActiveTab(item.id);
    } else {
      openTab(project.id, group, item);
    }
  }

  function handleStart() {
    selectProject(project.id);
    openTab(project.id, group, item);
  }

  function handleEdit() {
    selectProject(project.id);
    setView("settings");
    setFocusItem(item.id);
  }

  function handleDelete() {
    if (!confirmBeforeDelete || confirm(`Delete "${item.name}"?`)) {
      removeItem(project.id, group, item.id);
    }
  }

  const menuItems: ContextMenuItem[] =
    status === "running"
      ? [
          { label: "Stop", icon: <Square size={13} strokeWidth={2} />, onClick: () => stopItem(item.id) },
          { label: "Edit", icon: <Pencil size={13} strokeWidth={2} />, onClick: handleEdit },
          { label: "Delete", icon: <Trash2 size={13} strokeWidth={2} />, onClick: handleDelete, danger: true },
        ]
      : [
          {
            label: status === "exited" ? "Restart" : "Start",
            icon: <Play size={13} strokeWidth={2} />,
            onClick: handleStart,
          },
          { label: "Edit", icon: <Pencil size={13} strokeWidth={2} />, onClick: handleEdit },
          { label: "Delete", icon: <Trash2 size={13} strokeWidth={2} />, onClick: handleDelete, danger: true },
        ];

  return (
    <div
      className={`item-row${isActiveTab ? " item-row--active" : ""}`}
      onClick={handleRowClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <span className={`item-row__dot item-row__dot--${status}`} />
      <span className="item-row__name">{item.name}</span>
      {status === "running" ? (
        <button
          className="item-row__action"
          type="button"
          title="Stop"
          onClick={(e) => {
            e.stopPropagation();
            stopItem(item.id);
          }}
        >
          <Square size={12} strokeWidth={2} />
        </button>
      ) : (
        <button
          className="item-row__action"
          type="button"
          title={status === "exited" ? "Restart" : "Start"}
          onClick={(e) => {
            e.stopPropagation();
            handleStart();
          }}
        >
          <Play size={12} strokeWidth={2} />
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </div>
  );
}
