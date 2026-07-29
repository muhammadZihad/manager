// Tray icon: shows the running-session count in its tooltip, with a small
// menu (Show, Stop All, Quit). The window's close button hides it instead of
// quitting (see lib.rs) — the tray is how you get back to it, or fully quit.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::pty::PtyManager;

pub const TRAY_ID: &str = "main";

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Manager", true, None::<&str>)?;
    let stop_all_item = MenuItem::with_id(app, "stop_all", "Stop All Sessions", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &stop_all_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().expect("app has a default icon"))
        .tooltip("Manager — no sessions running")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_window(app),
            "stop_all" => app.state::<PtyManager>().kill_all(),
            "quit" => {
                app.state::<PtyManager>().kill_all();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Called whenever a session starts or stops so the tray reflects reality.
pub fn refresh_tooltip(app: &AppHandle, count: usize) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let text = match count {
        0 => "Manager — no sessions running".to_string(),
        1 => "Manager — 1 session running".to_string(),
        n => format!("Manager — {n} sessions running"),
    };
    let _ = tray.set_tooltip(Some(&text));
}
