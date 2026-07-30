// Footer strip showing live resource usage for the session currently on screen.
//
// Scoped to the active tab on purpose: sampling every running session would mean
// walking the whole process table per session on a timer, for numbers nobody is
// looking at.

import { useEffect, useState } from "react";
import { Cpu, GitBranch, MemoryStick, Network } from "lucide-react";
import { useStore } from "../store";
import { formatBytes, sessionUsage, type SessionUsage } from "../lib/usage";

const INTERVAL_MS = 2000;

export function StatusFooter() {
  const activeTabItemId = useStore((s) => s.activeTabItemId);
  const tab = useStore((s) => s.tabs.find((t) => t.itemId === s.activeTabItemId));
  const [usage, setUsage] = useState<SessionUsage | null>(null);

  const sessionId = tab?.sessionId ?? null;
  const isRunning = tab?.status === "running";

  useEffect(() => {
    setUsage(null);
    if (!sessionId || !isRunning) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await sessionUsage(sessionId);
        if (!cancelled) setUsage(next);
      } catch {
        // Usage is best-effort; a failed sample just leaves the last value.
      }
    };

    poll();
    const timer = setInterval(poll, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, isRunning]);

  // Nothing selected — keep the bar in place so the layout doesn't jump.
  if (!activeTabItemId || !tab) {
    return (
      <footer className="status-footer">
        <span className="status-footer__idle">No session selected</span>
      </footer>
    );
  }

  return (
    <footer className="status-footer">
      <span className={`status-footer__dot status-footer__dot--${tab.status}`} />
      <span className="status-footer__name">{tab.name}</span>

      {tab.status === "exited" ? (
        <span className="status-footer__idle">
          exited{tab.exitCode !== null ? ` (${tab.exitCode})` : ""}
        </span>
      ) : tab.status === "starting" ? (
        <span className="status-footer__idle">starting…</span>
      ) : (
        <>
          <span className="status-footer__metric" title="CPU across the process tree">
            <Cpu size={12} strokeWidth={2.25} />
            {usage ? `${usage.cpu_percent.toFixed(1)}%` : "—"}
          </span>
          <span className="status-footer__metric" title="Resident memory across the process tree">
            <MemoryStick size={12} strokeWidth={2.25} />
            {usage ? formatBytes(usage.memory_bytes) : "—"}
          </span>
          <span className="status-footer__metric" title="Child processes spawned by this session">
            <GitBranch size={12} strokeWidth={2.25} />
            {usage ? `${usage.subprocesses} sub` : "—"}
          </span>
          {tab.ports.length > 0 && (
            <span className="status-footer__metric" title="Listening ports">
              <Network size={12} strokeWidth={2.25} />
              {tab.ports.map((p) => `:${p}`).join(" ")}
            </span>
          )}
        </>
      )}
    </footer>
  );
}
