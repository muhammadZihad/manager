// Project tree: each project expands into its three groups (Commands, Agents,
// Terminals). Per-item status dots reflect the store's live tab registry;
// per-project Start spawns every autoStart item at once.

import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Play,
  RotateCcw,
  Search,
  Settings,
  SquareTerminal,
  SquareCode,
  Square,
} from "lucide-react";
import { useStore } from "../store";
import { pickDirectory } from "../lib/dialog";
import type { ItemGroup, Project, Runnable } from "../types";

const GROUPS: { key: ItemGroup; label: string; icon: typeof SquareCode }[] = [
  { key: "commands", label: "Commands", icon: SquareCode },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "terminals", label: "Terminals", icon: SquareTerminal },
];

/** A project in the sidebar; `items` is null when nothing is being filtered. */
type ProjectMatch = {
  project: Project;
  items: Record<ItemGroup, Runnable[]> | null;
};

/**
 * Commands are searched as well as names — "artisan" or "npm" is often what you
 * remember about an item, not whatever you happened to title it.
 */
function itemMatches(item: Runnable, query: string): boolean {
  return (
    item.name.toLowerCase().includes(query) || (item.command ?? "").toLowerCase().includes(query)
  );
}

export function Sidebar() {
  const config = useStore((s) => s.config);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const view = useStore((s) => s.view);
  const addProject = useStore((s) => s.addProject);
  const setView = useStore((s) => s.setView);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // In the store so the context menu's "New project" can open this form.
  const addingProject = useStore((s) => s.addingProject);
  const setAddingProject = useStore((s) => s.setAddingProject);

  const query = search.trim().toLowerCase();

  const matches = useMemo<ProjectMatch[]>(() => {
    if (!query) return config.projects.map((project) => ({ project, items: null }));

    const found: ProjectMatch[] = [];
    for (const project of config.projects) {
      // A project whose own name matches shows all of its items; otherwise only
      // the items that matched are shown, so the result reflects the query.
      if (project.name.toLowerCase().includes(query)) {
        found.push({ project, items: null });
        continue;
      }
      const items: Record<ItemGroup, Runnable[]> = {
        commands: project.commands.filter((i) => itemMatches(i, query)),
        agents: project.agents.filter((i) => itemMatches(i, query)),
        terminals: project.terminals.filter((i) => itemMatches(i, query)),
      };
      if (items.commands.length || items.agents.length || items.terminals.length) {
        found.push({ project, items });
      }
    }
    return found;
  }, [config.projects, query]);

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
        <Search size={15} strokeWidth={2.25} />
        <input
          id="sidebar-search"
          placeholder="Search projects & items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar__list" data-ctx="sidebar">
        {matches.map(({ project, items }) => (
          <ProjectRow
            key={project.id}
            project={project}
            visibleItems={items}
            isActive={project.id === activeProjectId}
            isExpanded={expanded.has(project.id) || query.length > 0}
            onToggle={() => toggle(project.id)}
          />
        ))}

        {matches.length === 0 && !addingProject && (
          <div className="sidebar__empty">
            {query
              ? `Nothing matches “${search.trim()}”.`
              : "No projects yet — create one to get started."}
          </div>
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
            <FolderPlus size={15} strokeWidth={2.25} />
            New Project
          </button>
        )}
      </div>

      <button
        className={`sidebar__app-settings${view === "app-settings" ? " sidebar__app-settings--active" : ""}`}
        type="button"
        onClick={() => setView("app-settings")}
      >
        <Settings size={15} strokeWidth={2.1} />
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
  visibleItems,
  isActive,
  isExpanded,
  onToggle,
}: {
  project: Project;
  visibleItems: Record<ItemGroup, Runnable[]> | null;
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
        data-ctx="project"
        data-project-id={project.id}
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
          {isExpanded ? <ChevronDown size={15} strokeWidth={2.4} /> : <ChevronRight size={15} strokeWidth={2.4} />}
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
          <Settings size={15} strokeWidth={2.1} />
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
            <Square size={13} strokeWidth={2.6} />
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
            <Play size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="project-row__groups">
          {GROUPS.map((group) => {
            const items = visibleItems ? visibleItems[group.key] : project[group.key];
            // While filtering, a group with no matches is noise — drop it.
            if (visibleItems && items.length === 0) return null;
            return <GroupSection key={group.key} project={project} group={group} items={items} />;
          })}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  project,
  group,
  items,
}: {
  project: Project;
  group: { key: ItemGroup; label: string; icon: typeof SquareCode };
  items: Runnable[];
}) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;

  return (
    <div className="group-section">
      <div
        className="group-section__header"
        data-ctx="group"
        data-group={group.key}
        data-project-id={project.id}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown size={13} strokeWidth={2.5} />
        ) : (
          <ChevronRight size={13} strokeWidth={2.5} />
        )}
        <Icon
          className={`group-section__icon group-section__icon--${group.key}`}
          size={15}
          strokeWidth={2.25}
        />
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

// Right-click behaviour lives in AppContextMenu, resolved from the data-ctx
// attributes below — this row only declares what it is.
function ItemRow({ project, group, item }: { project: Project; group: ItemGroup; item: Runnable }) {
  const tabs = useStore((s) => s.tabs);
  const activeTabItemId = useStore((s) => s.activeTabItemId);
  const openTab = useStore((s) => s.openTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const stopItem = useStore((s) => s.stopItem);
  const selectProject = useStore((s) => s.selectProject);

  const tab = tabs.find((t) => t.itemId === item.id);
  const status = tab?.status ?? "idle";
  const ports = tab?.ports ?? [];
  const isActiveTab = item.id === activeTabItemId;

  function handleRowClick() {
    selectProject(project.id);
    // Clicking only reveals an already-open session. Starting is deliberately
    // explicit — via the play button or the context menu — so a stray click on
    // a row can never launch a process.
    if (tab) setActiveTab(item.id);
  }

  function handleStart() {
    selectProject(project.id);
    openTab(project.id, group, item);
  }

  return (
    <div
      className={`item-row${isActiveTab ? " item-row--active" : ""}`}
      data-ctx="item"
      data-item-id={item.id}
      data-project-id={project.id}
      data-group={group}
      onClick={handleRowClick}
    >
      <span className={`item-row__dot item-row__dot--${status}`} />
      <span className="item-row__name">{item.name}</span>

      {/* Ports and the action buttons share this slot: ports show at rest, the
          buttons replace them on hover, so the row never changes height. */}
      <span className="item-row__trail">
        {ports.length > 0 && (
          <span className="item-row__ports">{ports.map((p) => `:${p}`).join(" ")}</span>
        )}
        <span className="item-row__actions">
          {status !== "idle" && (
            <button
              className="item-row__action"
              type="button"
              title="Restart"
              onClick={(e) => {
                e.stopPropagation();
                handleStart();
              }}
            >
              <RotateCcw size={13} strokeWidth={2.25} />
            </button>
          )}
          {status === "running" ? (
            <button
              className="item-row__action item-row__action--stop"
              type="button"
              title="Stop"
              onClick={(e) => {
                e.stopPropagation();
                stopItem(item.id);
              }}
            >
              <Square size={12} strokeWidth={2.6} />
            </button>
          ) : (
            <button
              className="item-row__action"
              type="button"
              title="Start"
              onClick={(e) => {
                e.stopPropagation();
                handleStart();
              }}
            >
              <Play size={13} strokeWidth={2.25} />
            </button>
          )}
        </span>
      </span>
    </div>
  );
}
