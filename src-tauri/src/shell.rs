// Detects shells installed on the system so the frontend can offer a picker
// instead of requiring the user to type a shell binary name from memory.

#[tauri::command]
pub fn list_shells() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec!["cmd".to_string(), "powershell".to_string(), "pwsh".to_string()]
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::fs::read_to_string("/etc/shells")
            .map(|contents| {
                contents
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty() && !line.starts_with('#'))
                    .map(String::from)
                    .collect()
            })
            .unwrap_or_else(|_| vec!["/bin/zsh".to_string(), "/bin/bash".to_string()])
    }
}
