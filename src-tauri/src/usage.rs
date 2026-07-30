// Live CPU / memory / process-count for one session, for the status footer.
//
// Two things drive the design:
//
// 1. A session is a *tree*, not one process. `php artisan serve` forks the real
//    server; `npm run dev` execs a bundler. Reporting only the process we
//    spawned would show ~0% CPU while the machine is busy, so everything is
//    summed over the spawned process and all of its descendants.
//
// 2. CPU has to be sampled, not read. A percentage is a delta between two
//    observations, so the `System` is kept alive in Tauri state across calls —
//    a fresh one every call would always report 0%.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::State;

use crate::pty::PtyManager;

pub struct UsageMonitor {
    system: Mutex<System>,
}

impl Default for UsageMonitor {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new()),
        }
    }
}

#[derive(Serialize, Clone)]
pub struct SessionUsage {
    /// Summed across the tree, so it can exceed 100% on multiple cores.
    cpu_percent: f32,
    memory_bytes: u64,
    /// Descendants of the spawned process, excluding it.
    subprocesses: usize,
}

#[tauri::command]
pub fn session_usage(
    pty: State<'_, PtyManager>,
    monitor: State<'_, UsageMonitor>,
    session_id: String,
) -> Option<SessionUsage> {
    let root = pty
        .session_pids()
        .into_iter()
        .find(|(id, _)| *id == session_id)
        .map(|(_, pid)| pid)?;

    let mut system = monitor.system.lock().unwrap();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    // Index children by parent once; walking `processes()` per node would be
    // quadratic on a busy machine.
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }

    let root = Pid::from_u32(root);
    let mut cpu_percent = 0.0;
    let mut memory_bytes = 0;
    let mut count = 0usize;

    let mut stack = vec![root];
    let mut seen = std::collections::HashSet::new();
    while let Some(pid) = stack.pop() {
        // Guards against a pid cycle, which shouldn't happen but would hang.
        if !seen.insert(pid) {
            continue;
        }
        if let Some(process) = system.process(pid) {
            cpu_percent += process.cpu_usage();
            memory_bytes += process.memory();
            count += 1;
        }
        if let Some(kids) = children.get(&pid) {
            stack.extend(kids.iter().copied());
        }
    }

    if count == 0 {
        return None; // process is gone; the footer falls back to its exited state
    }

    Some(SessionUsage {
        cpu_percent,
        memory_bytes,
        subprocesses: count.saturating_sub(1),
    })
}
