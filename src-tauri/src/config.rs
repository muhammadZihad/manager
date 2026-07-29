// Loads and saves the app's single JSON config file (projects, their commands,
// terminals, and agents). The frontend owns the shape/validation of the data —
// the backend just persists whatever JSON it's handed, so the type stays in
// one place (src/types.ts) instead of duplicated across Rust and TS.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("projects.json"))
}

#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({ "version": 1, "projects": [] }));
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        log::error!("failed to read config at {path:?}: {e}");
        e.to_string()
    })?;
    serde_json::from_str(&raw).map_err(|e| {
        log::error!("config at {path:?} is not valid JSON: {e}");
        e.to_string()
    })
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: serde_json::Value) -> Result<(), String> {
    let path = config_path(&app)?;
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| {
        log::error!("failed to write config to {path:?}: {e}");
        e.to_string()
    })
}
