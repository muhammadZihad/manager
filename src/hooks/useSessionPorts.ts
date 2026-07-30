// Polls which ports the running sessions are listening on.
//
// Polling rather than pushing because a process can start or stop listening at
// any time with no event to hook — a dev server binds its port a second or two
// after spawn. The backend answers with a single lsof call for all sessions, and
// the timer only runs while something is actually running.

import { useEffect } from "react";
import { useStore } from "../store";
import { sessionPorts } from "../lib/ports";

const INTERVAL_MS = 4000;

export function useSessionPorts() {
  // Re-subscribes when the number of running sessions changes, which is what
  // starts and stops the timer.
  const runningCount = useStore((s) => s.tabs.filter((t) => t.status === "running").length);

  useEffect(() => {
    if (runningCount === 0) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const ports = await sessionPorts();
        if (!cancelled) useStore.getState().setSessionPorts(ports);
      } catch {
        // Port reporting is best-effort; never surface it as an error.
      }
    };

    poll();
    const timer = setInterval(poll, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runningCount]);
}
