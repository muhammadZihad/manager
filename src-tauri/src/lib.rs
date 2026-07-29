mod config;
mod import;
mod pty;
mod shell;
mod transfer;
mod tray;

use pty::PtyManager;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .manage(PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            pty::spawn_session,
            pty::start_reading,
            pty::write_to_session,
            pty::resize_session,
            pty::kill_session,
            config::load_config,
            config::save_config,
            shell::list_shells,
            import::detect_importable_commands,
            transfer::export_projects,
            transfer::import_projects,
        ])
        .setup(|app| {
            tray::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it instead of quitting — sessions keep
            // running in the background, reachable again via the tray icon.
            // A real quit only happens via the tray's Quit item or Cmd/Ctrl+Q,
            // which fire RunEvent::ExitRequested below instead of this.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let running = app_handle.state::<PtyManager>().running_count();
                if running > 0 {
                    api.prevent_exit();
                    let confirmed = app_handle
                        .dialog()
                        .message(format!(
                            "{running} session{} still running. Quit anyway?",
                            if running == 1 { "" } else { "s" }
                        ))
                        .title("Quit Manager")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::OkCancelCustom("Quit".into(), "Cancel".into()))
                        .blocking_show();
                    if confirmed {
                        app_handle.state::<PtyManager>().kill_all();
                        app_handle.exit(0);
                    }
                }
            }
        });
}
