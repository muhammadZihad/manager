// Reports which TCP ports each running session is listening on, so the sidebar
// can show "…:8000" under an item.
//
// Two things make this non-obvious:
//
// 1. The port is usually held by a *grandchild*, not the process we spawned:
//    `php artisan serve` forks the real server, and `npm run dev` execs a
//    bundler. Querying by pid finds nothing, so we match on process *group*
//    instead — the PTY child is a session leader, so the whole job shares its
//    group id.
//
// 2. One lsof call covers every session. Invoking lsof per session on a timer
//    would multiply process spawns for no benefit.

use std::collections::{HashMap, HashSet};

use tauri::State;

use crate::pty::PtyManager;

/// session id -> listening TCP ports.
#[tauri::command]
pub fn session_ports(state: State<'_, PtyManager>) -> HashMap<String, Vec<u16>> {
    let by_group = listening_ports_by_group();
    if by_group.is_empty() {
        return HashMap::new();
    }
    state
        .session_pids()
        .into_iter()
        .filter_map(|(session_id, pgid)| by_group.get(&pgid).map(|ports| (session_id, ports.clone())))
        .collect()
}

#[cfg(unix)]
fn listening_ports_by_group() -> HashMap<u32, Vec<u16>> {
    // -Fpgn gives machine-readable records: "p<pid>", "g<pgid>", "n<addr:port>".
    let output = std::process::Command::new("lsof")
        .args(["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpgn"])
        .output();

    // lsof may be missing (some minimal Linux images); the feature just goes quiet.
    let Ok(output) = output else {
        return HashMap::new();
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let mut found: HashMap<u32, HashSet<u16>> = HashMap::new();
    let mut group: Option<u32> = None;

    for line in text.lines() {
        let Some(tag) = line.chars().next() else { continue };
        let value = &line[1..];
        match tag {
            // A new process record; the group id arrives on the following line.
            'p' => group = None,
            'g' => group = value.parse().ok(),
            'n' => {
                if let Some(pgid) = group {
                    // Names look like "*:8000", "127.0.0.1:8000" or "[::1]:8000".
                    if let Some(port) = value.rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
                        found.entry(pgid).or_default().insert(port);
                    }
                }
            }
            _ => {}
        }
    }

    found
        .into_iter()
        .map(|(pgid, ports)| {
            let mut ports: Vec<u16> = ports.into_iter().collect();
            ports.sort_unstable();
            (pgid, ports)
        })
        .collect()
}

#[cfg(not(unix))]
fn listening_ports_by_group() -> HashMap<u32, Vec<u16>> {
    // Windows has no equivalent process-group grouping for this, and netstat
    // reports only pids — matching a job's descendants would mean walking the
    // process tree. Not implemented yet, so no ports are shown there.
    HashMap::new()
}
