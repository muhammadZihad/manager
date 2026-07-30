// Owns PTY sessions, keyed by a tab's runId.
//
// Why this exists rather than spawning inside the Terminal component's effect:
// React StrictMode deliberately runs an effect, cleans it up, then runs it
// again. With the spawn living in the effect that meant two real OS processes
// per terminal — harmless for a shell, but two `php artisan serve` processes
// race for the same port and the survivor can fail to bind. Session lifetime
// simply isn't tied to a component's render lifecycle, so it lives here: a
// second ensureSession() for the same runId returns the existing session
// instead of starting another process.
//
// This module also owns the output listeners and buffers anything that arrives
// while no terminal is attached, so a remount replays what it missed rather
// than showing an empty pane.
//
// Kill ownership: exactly one place. The store calls stopRun (kill the process,
// keep listening so the exit code still lands) or closeRun (kill and forget —
// the tab is going away). Components never kill; they only attach and detach.

import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  killSession,
  onExit,
  onOutput,
  resizeSession,
  spawnSession,
  startReading,
  writeToSession,
  type SpawnOpts,
} from "./pty";

export type SessionView = {
  onData: (bytes: Uint8Array) => void;
  onExit: (code: number | null) => void;
  onError: (message: string) => void;
};

type Session = {
  sessionId: string | null;
  /** Resolves with the session id once the process is spawned and streaming. */
  ready: Promise<string>;
  view: SessionView | null;
  /** Output received while nothing was attached; replayed on the next attach. */
  backlog: Uint8Array[];
  backlogBytes: number;
  exited: boolean;
  exitCode: number | null;
  error: string | null;
  unlisten: UnlistenFn[];
};

/** Cap on output held for a detached view, so a noisy background session can't grow without bound. */
const MAX_BACKLOG_BYTES = 1_000_000;

const sessions = new Map<string, Session>();

/**
 * Start the session for `runId`, or return the existing one. Safe to call
 * repeatedly — only the first call spawns a process.
 */
export function ensureSession(runId: string, opts: SpawnOpts): Session {
  const existing = sessions.get(runId);
  if (existing) return existing;

  const session: Session = {
    sessionId: null,
    ready: undefined as unknown as Promise<string>,
    view: null,
    backlog: [],
    backlogBytes: 0,
    exited: false,
    exitCode: null,
    error: null,
    unlisten: [],
  };
  sessions.set(runId, session);

  session.ready = (async () => {
    const id = await spawnSession(opts);

    // closeRun() removes the entry; if that happened while we were spawning,
    // the process would otherwise be left with nothing tracking it.
    if (sessions.get(runId) !== session) {
      await killSession(id).catch(() => {});
      throw new Error("session was closed before it finished starting");
    }

    session.sessionId = id;

    // Listeners are attached before start_reading, which is what guarantees no
    // early output is missed (see the contract note in lib/pty.ts).
    session.unlisten.push(await onOutput(id, (bytes) => receive(session, bytes)));
    session.unlisten.push(await onExit(id, (code) => finish(session, code)));

    await startReading(id);
    return id;
  })();

  session.ready.catch((err) => {
    session.error = String(err);
    session.view?.onError(session.error);
  });

  return session;
}

function receive(session: Session, bytes: Uint8Array) {
  if (session.view) {
    session.view.onData(bytes);
    return;
  }
  session.backlog.push(bytes);
  session.backlogBytes += bytes.byteLength;
  while (session.backlogBytes > MAX_BACKLOG_BYTES && session.backlog.length > 1) {
    const dropped = session.backlog.shift();
    if (dropped) session.backlogBytes -= dropped.byteLength;
  }
}

function finish(session: Session, code: number | null) {
  session.exited = true;
  session.exitCode = code;
  session.view?.onExit(code);
}

/**
 * Point a terminal at the session. Replays any missed output first, then
 * streams live. Returns a detach function.
 */
export function attachSession(runId: string, view: SessionView): () => void {
  const session = sessions.get(runId);
  if (!session) return () => {};

  session.view = view;

  for (const chunk of session.backlog) view.onData(chunk);
  session.backlog = [];
  session.backlogBytes = 0;

  // A freshly attached terminal starts empty, so it needs to be told about an
  // outcome that already happened.
  if (session.error) view.onError(session.error);
  else if (session.exited) view.onExit(session.exitCode);

  return () => {
    if (session.view === view) session.view = null;
  };
}

async function resolveId(runId: string): Promise<string | null> {
  const session = sessions.get(runId);
  if (!session) return null;
  if (session.sessionId) return session.sessionId;
  return session.ready.catch(() => null);
}

export async function writeToRun(runId: string, data: string): Promise<void> {
  const id = await resolveId(runId);
  if (id) await writeToSession(id, data).catch(() => {});
}

export async function resizeRun(runId: string, cols: number, rows: number): Promise<void> {
  const id = await resolveId(runId);
  if (id) await resizeSession(id, cols, rows).catch(() => {});
}

/**
 * Kill the process but keep the session's listeners attached, so the exit event
 * still arrives and the UI can report the exit code. Used by Stop.
 */
export async function stopRun(runId: string): Promise<void> {
  const id = await resolveId(runId);
  if (id) await killSession(id).catch(() => {});
}

/** Kill the process and forget the session entirely. Used when a tab closes. */
export async function closeRun(runId: string): Promise<void> {
  const session = sessions.get(runId);
  if (!session) return;

  sessions.delete(runId);
  session.view = null;

  const id = session.sessionId ?? (await session.ready.catch(() => null));
  if (id) await killSession(id).catch(() => {});

  for (const un of session.unlisten) un();
  session.unlisten = [];
}
