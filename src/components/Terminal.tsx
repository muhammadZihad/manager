// Binds one xterm.js instance to one PTY session for the lifetime of a tab.
// Mounted once per open tab (keyed by tab.runId in TerminalGrid) so restarting
// an item always gets a fresh terminal instead of stale scrollback.

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useStore, type Tab } from "../store";
import type { Project, Runnable } from "../types";
import { killSession, onExit, onOutput, resizeSession, spawnSession, startReading, writeToSession } from "../lib/pty";
import { parseCommand } from "../lib/command";
import { error as logError } from "@tauri-apps/plugin-log";

type Props = {
  tab: Tab;
  project: Project;
  item: Runnable;
  active: boolean;
};

export function TerminalPane({ tab, project, item, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setTabSession = useStore((s) => s.setTabSession);
  const setTabExited = useStore((s) => s.setTabExited);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Snapshot at creation time — font/scrollback changes apply to newly
    // opened terminals, not ones already running (see AppSettingsView hint).
    const settings = useStore.getState().config.settings;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      scrollback: settings.terminalScrollback,
      allowProposedApi: true,
      theme: {
        background: "#181a20",
        foreground: "#e4e6eb",
        cursor: "#2ee6a6",
        selectionBackground: "#2ee6a655",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    let disposed = false;
    let sessionId: string | null = null;
    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const dataDisposable = term.onData((data) => {
      if (sessionId) writeToSession(sessionId, data).catch(() => {});
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      if (sessionId) resizeSession(sessionId, term.cols, term.rows).catch(() => {});
    });
    resizeObserver.observe(container);

    (async () => {
      try {
        const cwd = item.cwd || project.directory;
        const { program, args } = parseCommand(item.command ?? "");
        const effectiveProgram = program ?? (tab.group === "terminals" ? settings.defaultShell : undefined);
        const id = await spawnSession({
          program: effectiveProgram,
          args,
          cwd,
          env: item.env,
          cols: term.cols,
          rows: term.rows,
        });

        if (disposed) {
          // Tab was closed before spawn resolved — don't leak the process.
          killSession(id).catch(() => {});
          return;
        }

        sessionId = id;
        setTabSession(tab.itemId, id);

        unlistenOutput = await onOutput(id, (bytes) => term.write(bytes));
        unlistenExit = await onExit(id, (code) => {
          term.write(`\r\n\x1b[2m[exited: ${code ?? "signal"}]\x1b[0m\r\n`);
          setTabExited(tab.itemId, code);
        });

        await startReading(id);
      } catch (err) {
        term.write(`\r\n\x1b[31mFailed to start: ${String(err)}\x1b[0m\r\n`);
        logError(`Failed to spawn session for item ${item.id} (${item.name}): ${String(err)}`).catch(() => {});
      }
    })();

    return () => {
      disposed = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      term.dispose();
    };
    // Deliberately re-run only when this tab's run generation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.runId]);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        containerRef.current?.querySelector("textarea")?.focus();
      });
    }
  }, [active]);

  return (
    <div className={`terminal-pane${active ? " terminal-pane--active" : ""}`}>
      <div ref={containerRef} className="terminal-pane__xterm" />
    </div>
  );
}
