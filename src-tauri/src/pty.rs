// PTY session management: spawn/write/resize/kill shell & CLI (agent) processes,
// and stream their output back to the frontend as Tauri events.
//
// Concurrency model:
// - `PtyManager.sessions` is a plain `std::sync::Mutex` — every command below only
//   ever locks it for a short, synchronous critical section (no `.await` while held).
// - PTY reads block, so each session gets its own dedicated OS thread for reading
//   (never run on the async runtime). A second dedicated thread reaps the child
//   process via a blocking `wait()` and emits the exit event.
// - To avoid a race where a fast program's first output arrives before the
//   frontend has attached its `listen()`, the reader is created but not spun up
//   until the frontend explicitly calls `start_reading`.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};

use base64::Engine as _;
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    reader: Option<Box<dyn Read + Send>>,
    reader_handle: Option<JoinHandle<()>>,
    /// Direct child's pid. Because portable-pty calls setsid(), the child is a
    /// session/process-group leader, so this doubles as the process-group id for
    /// the whole job — needed both to kill descendants and to find which ports
    /// the job is listening on.
    pid: Option<u32>,
}

/// Signal an entire process group.
///
/// Killing only the direct child is not enough: `npm run dev` or
/// `php artisan serve` fork a grandchild that is the process actually holding
/// the port, and it survives its parent. Signalling the group reaches them.
#[cfg(unix)]
fn signal_group(pid: u32, signal: i32) {
    // Safety: killpg is async-signal-safe and takes plain integers. A failure
    // (group already gone) is reported via errno, which we intentionally ignore.
    unsafe {
        libc::killpg(pid as libc::pid_t, signal);
    }
}

#[cfg(not(unix))]
fn signal_group(_pid: u32, _signal: i32) {
    // Windows has no process groups in this sense; ChildKiller::kill handles the
    // ConPTY child, and descendants are left to the console teardown.
}

#[cfg(unix)]
const SIG_TERM: i32 = libc::SIGTERM;
#[cfg(not(unix))]
const SIG_TERM: i32 = 15;

#[cfg(unix)]
const SIG_KILL: i32 = libc::SIGKILL;
#[cfg(not(unix))]
const SIG_KILL: i32 = 9;

#[derive(Default)]
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    /// Kill every live session and everything it spawned. Called on app exit so
    /// nothing is left holding a port after Manager is gone.
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        for (_, mut session) in sessions.drain() {
            // The app is going away, so don't wait for a graceful shutdown.
            if let Some(pid) = session.pid {
                signal_group(pid, SIG_KILL);
            }
            let _ = session.killer.kill();
        }
    }

    /// Number of currently-live PTY sessions (used for the tray tooltip and
    /// the quit confirmation prompt).
    pub fn running_count(&self) -> usize {
        self.sessions.lock().unwrap().len()
    }

    /// (session id, process-group id) for every session that has a pid.
    pub fn session_pids(&self) -> Vec<(String, u32)> {
        self.sessions
            .lock()
            .unwrap()
            .iter()
            .filter_map(|(id, session)| session.pid.map(|pid| (id.clone(), pid)))
            .collect()
    }
}

#[derive(Deserialize)]
pub struct SpawnOpts {
    /// Program to run. Omit for the platform default shell (used by plain Terminals).
    pub program: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory. Frontend resolves this (item cwd, else project directory)
    /// before calling spawn — the backend just uses whatever it's given.
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Serialize, Clone)]
struct OutputPayload {
    data: String, // base64-encoded raw bytes
}

#[derive(Serialize, Clone)]
struct ExitPayload {
    session_id: String,
    code: Option<u32>,
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

#[tauri::command]
pub fn spawn_session(
    app: AppHandle,
    state: State<'_, PtyManager>,
    opts: SpawnOpts,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: opts.rows.max(1),
            cols: opts.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let program = opts.program.clone().unwrap_or_else(default_shell);
    log::info!("spawning session: program={program:?} args={:?} cwd={:?}", opts.args, opts.cwd);
    let mut cmd = CommandBuilder::new(program);
    for arg in &opts.args {
        cmd.arg(arg);
    }
    if let Some(cwd) = &opts.cwd {
        cmd.cwd(cwd);
    }
    for (key, value) in &opts.env {
        cmd.env(key, value);
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let killer = child.clone_killer();
    let pid = child.process_id();
    // Drop our end of the slave now that the child owns it (standard portable-pty hygiene).
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let session_id = uuid::Uuid::new_v4().to_string();

    state.sessions.lock().unwrap().insert(
        session_id.clone(),
        PtySession {
            master: pair.master,
            writer,
            killer,
            reader: Some(reader),
            reader_handle: None,
            pid,
        },
    );

    crate::tray::refresh_tooltip(&app, state.running_count());
    spawn_reaper_thread(app, session_id.clone(), child);

    Ok(session_id)
}

/// Starts the reader thread for a session. Must be called by the frontend only
/// after it has attached its `pty://output/{id}` listener, to avoid missing
/// early output from fast-starting programs.
///
/// Idempotent: the frontend re-attaches a terminal to an existing session (on
/// remount) and calls this again, so a second call is a no-op rather than an
/// error.
#[tauri::command]
pub fn start_reading(
    app: AppHandle,
    state: State<'_, PtyManager>,
    session_id: String,
) -> Result<(), String> {
    let reader = {
        let mut sessions = state.sessions.lock().unwrap();
        let session = sessions.get_mut(&session_id).ok_or("no such session")?;
        match session.reader.take() {
            Some(reader) => reader,
            None => return Ok(()), // already streaming
        }
    };

    let handle = spawn_reader_thread(app, session_id.clone(), reader);

    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        session.reader_handle = Some(handle);
    }
    Ok(())
}

#[tauri::command]
pub fn write_to_session(
    state: State<'_, PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(&session_id).ok_or("no such session")?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_session(
    state: State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("no such session")?;
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn kill_session(app: AppHandle, state: State<'_, PtyManager>, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&session_id) {
        // SIGTERM the group first so servers get a chance to shut down cleanly,
        // then SIGKILL the direct child so the session always ends and the
        // reaper thread reports the exit.
        if let Some(pid) = session.pid {
            signal_group(pid, SIG_TERM);
        }
        let _ = session.killer.kill();
    }
    drop(sessions);
    crate::tray::refresh_tooltip(&app, state.running_count());
    Ok(())
}

fn spawn_reader_thread(
    app: AppHandle,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        let event_name = format!("pty://output/{session_id}");
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF: process closed its end of the pty
                Ok(n) => {
                    let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app.emit(&event_name, OutputPayload { data });
                }
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
    })
}

fn spawn_reaper_thread(app: AppHandle, session_id: String, mut child: Box<dyn Child + Send + Sync>) {
    thread::spawn(move || {
        let status = child.wait();
        let code = status.ok().map(|s| s.exit_code());
        log::info!("session {session_id} exited with code {code:?}");

        let _ = app.emit(
            &format!("pty://exit/{session_id}"),
            ExitPayload {
                session_id: session_id.clone(),
                code,
            },
        );

        // Clean up: drop the session (closes master/writer/killer) and let the
        // reader thread finish on its own (it will see EOF once the pty closes).
        let pty_manager = app.state::<PtyManager>();
        pty_manager.sessions.lock().unwrap().remove(&session_id);
        crate::tray::refresh_tooltip(&app, pty_manager.running_count());
    });
}
