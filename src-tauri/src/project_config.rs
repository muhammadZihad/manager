// Reads and writes a project's own settings file, which lives inside the
// project directory rather than in the app's config dir. The point is that the
// file can be committed, so a team shares one set of commands and agents.
//
// The frontend decides the path and the shape; this only does the file I/O.

use std::fs;
use std::path::Path;

#[tauri::command]
pub fn save_project_config(path: String, config: serde_json::Value) -> Result<(), String> {
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    // A trailing newline keeps diffs clean when the file is committed.
    fs::write(&path, format!("{pretty}\n")).map_err(|e| {
        log::error!("failed to write project config to {path}: {e}");
        e.to_string()
    })
}

/// `Ok(None)` when the file simply isn't there yet — that's the normal state
/// before the toggle is first switched on, not an error.
#[tauri::command]
pub fn load_project_config(path: String) -> Result<Option<serde_json::Value>, String> {
    if !Path::new(&path).exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        log::warn!("could not read project config {path}: {e}");
        e.to_string()
    })?;
    match serde_json::from_str(&raw) {
        Ok(value) => Ok(Some(value)),
        Err(e) => {
            // A hand-edited or half-merged file shouldn't stop the project from
            // loading; fall back to whatever the app already has.
            log::warn!("project config {path} is not valid JSON, ignoring: {e}");
            Ok(None)
        }
    }
}
