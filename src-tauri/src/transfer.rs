// Export/import projects to/from a standalone JSON file — used for backup,
// moving to a new machine, or sharing a team's setup. The file always holds
// a JSON array of Project objects (even a single-project export), so import
// logic is uniform regardless of how many projects were exported.

use std::fs;

#[tauri::command]
pub fn export_projects(path: String, projects: serde_json::Value) -> Result<(), String> {
    let pretty = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| {
        log::error!("failed to export projects to {path}: {e}");
        e.to_string()
    })
}

#[tauri::command]
pub fn import_projects(path: String) -> Result<serde_json::Value, String> {
    let raw = fs::read_to_string(&path).map_err(|e| {
        log::error!("failed to read import file {path}: {e}");
        e.to_string()
    })?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}
