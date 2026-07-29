// Detects existing scripts in a project directory (package.json scripts,
// Makefile targets) so the frontend can offer to import them as Commands
// instead of the user retyping every script by hand.

use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct ImportCandidate {
    pub name: String,
    pub command: String,
    pub source: String,
}

#[tauri::command]
pub fn detect_importable_commands(directory: String) -> Vec<ImportCandidate> {
    let dir = Path::new(&directory);
    let mut candidates = from_package_json(dir);
    candidates.extend(from_makefile(dir));
    candidates
}

fn package_manager_prefix(dir: &Path) -> &'static str {
    if dir.join("pnpm-lock.yaml").exists() {
        "pnpm run"
    } else if dir.join("yarn.lock").exists() {
        "yarn"
    } else {
        "npm run"
    }
}

fn from_package_json(dir: &Path) -> Vec<ImportCandidate> {
    let Ok(contents) = std::fs::read_to_string(dir.join("package.json")) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return Vec::new();
    };
    let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) else {
        return Vec::new();
    };
    let prefix = package_manager_prefix(dir);
    scripts
        .keys()
        .map(|name| ImportCandidate {
            name: name.clone(),
            command: format!("{prefix} {name}"),
            source: "package.json".to_string(),
        })
        .collect()
}

fn from_makefile(dir: &Path) -> Vec<ImportCandidate> {
    let path = if dir.join("Makefile").exists() {
        dir.join("Makefile")
    } else if dir.join("makefile").exists() {
        dir.join("makefile")
    } else {
        return Vec::new();
    };
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };

    contents
        .lines()
        .filter_map(|line| {
            // Recipe lines are indented; target lines are not.
            if line.starts_with('\t') || line.starts_with(' ') || line.trim().is_empty() {
                return None;
            }
            let line = line.trim();
            if line.starts_with('#') || line.starts_with('.') {
                return None; // comments, .PHONY etc.
            }
            let (target, rest) = line.split_once(':')?;
            // Skip pattern rules and variable assignments (`FOO := bar`, `%.o: %.c`).
            if target.contains('%') || target.contains('=') || target.contains(' ') {
                return None;
            }
            if rest.trim_start().starts_with('=') {
                return None;
            }
            Some(ImportCandidate {
                name: target.to_string(),
                command: format!("make {target}"),
                source: "Makefile".to_string(),
            })
        })
        .collect()
}
