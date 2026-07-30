// Binds one xterm.js instance to one PTY session for the lifetime of a tab.
// Mounted once per open tab (keyed by tab.runId in TerminalGrid) so restarting
// an item always gets a fresh terminal instead of stale scrollback.
//
// This component does not own the process: it asks lib/session.ts to ensure a
// session exists for this runId and attaches a terminal to it. That keeps the
// PTY independent of React's effect lifecycle (StrictMode runs effects twice)
// and means remounting replays missed output instead of spawning again.

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useStore, type Tab } from "../store";
import type { Project, Runnable } from "../types";
import { attachSession, ensureSession, resizeRun, writeToRun } from "../lib/session";
import { registerTerminal, unregisterTerminal } from "../lib/terminals";
import { parseCommand } from "../lib/command";
import { getColorProfile } from "../lib/colorProfiles";
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

    // Snapshot at creation time — appearance changes apply to newly opened
    // terminals, not ones already running (see AppSettingsView hint).
    const settings = useStore.getState().config.settings;

    const term = new XTerm({
      cursorBlink: settings.terminalCursorBlink,
      cursorStyle: settings.terminalCursorStyle,
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      lineHeight: settings.terminalLineHeight,
      scrollback: settings.terminalScrollback,
      allowProposedApi: true,
      theme: getColorProfile(settings.terminalColorProfile).theme,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    // Lets the context menu act on this terminal (copy selection, clear…).
    registerTerminal(tab.runId, term);

    const { program, args } = parseCommand(item.command ?? "");
    const session = ensureSession(tab.runId, {
      program: program ?? (tab.group === "terminals" ? settings.defaultShell : undefined),
      args,
      cwd: item.cwd || project.directory,
      env: item.env,
      cols: term.cols,
      rows: term.rows,
    });

    const detach = attachSession(tab.runId, {
      onData: (bytes) => term.write(bytes),
      onExit: (code) => {
        term.write(`\r\n\x1b[2m[exited: ${code ?? "signal"}]\x1b[0m\r\n`);
        setTabExited(tab.itemId, code);
      },
      onError: (message) => {
        term.write(`\r\n\x1b[31mFailed to start: ${message}\x1b[0m\r\n`);
        logError(`Failed to spawn session for item ${item.id} (${item.name}): ${message}`).catch(() => {});
      },
    });

    session.ready.then((id) => setTabSession(tab.itemId, id)).catch(() => {
      // Already surfaced through onError above.
    });

    const dataDisposable = term.onData((data) => {
      writeToRun(tab.runId, data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      resizeRun(tab.runId, term.cols, term.rows);
    });
    resizeObserver.observe(container);

    // No kill here: the process outlives this component. The store owns
    // stopping (stopRun) and closing (closeRun).
    return () => {
      detach();
      unregisterTerminal(tab.runId, term);
      dataDisposable.dispose();
      resizeObserver.disconnect();
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
    <div
      className={`terminal-pane${active ? " terminal-pane--active" : ""}`}
      data-ctx="terminal"
      data-run-id={tab.runId}
      data-item-id={tab.itemId}
    >
      <div ref={containerRef} className="terminal-pane__xterm" />
    </div>
  );
}
