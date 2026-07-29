// Terminal panes for the active project. Every open tab (across every
// project) stays mounted the whole time — switching projects or items only
// toggles visibility — so a background session's PTY and xterm buffer are
// never torn down just because you looked away from it. Which tab is "open"
// is identified in the sidebar itself (the active item row), not a tab bar.

import { useStore } from "../store";
import type { Project, Runnable } from "../types";
import { TerminalPane } from "./Terminal";

export function TerminalGrid() {
  const config = useStore((s) => s.config);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const tabs = useStore((s) => s.tabs);
  const activeTabItemId = useStore((s) => s.activeTabItemId);

  const tabsForProject = tabs.filter((t) => t.projectId === activeProjectId);

  if (!activeProjectId) {
    return <EmptyState message="Select or create a project to get started." />;
  }

  return (
    <div className="terminal-grid">
      {tabsForProject.length === 0 && (
        <EmptyState message="No running sessions — start a command, agent, or terminal from the sidebar." />
      )}
      {tabs.map((tab) => {
        const found = findItem(config.projects, tab);
        if (!found) return null;
        return (
          <TerminalPane
            key={tab.runId}
            tab={tab}
            project={found.project}
            item={found.item}
            active={tab.itemId === activeTabItemId}
          />
        );
      })}
    </div>
  );
}

function findItem(
  projects: Project[],
  tab: { projectId: string; group: "commands" | "agents" | "terminals"; itemId: string },
): { project: Project; item: Runnable } | null {
  const project = projects.find((p) => p.id === tab.projectId);
  if (!project) return null;
  const item = project[tab.group].find((i) => i.id === tab.itemId);
  if (!item) return null;
  return { project, item };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}
