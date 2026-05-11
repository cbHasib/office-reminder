// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};
use tauri_plugin_autostart::MacosLauncher;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // Tray menu: show, settings, quit.
            let show_item     = MenuItem::with_id(app, "show",     "Show window",          true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Open settings",        true, None::<&str>)?;
            let quit_item     = MenuItem::with_id(app, "quit",     "Quit Office Reminder", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" | "settings" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up, ..
                    } = event
                    {
                        let app = tray.app_handle();
                        // Toggle visibility on left-click
                        if let Some(win) = app.get_webview_window("main") {
                            let visible = win.is_visible().unwrap_or(false);
                            if visible { let _ = win.hide(); }
                            else       { show_main_window(app); }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // Hide window on close (don't quit the app — tray and Dock keep it alive).
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Office Reminder");

    app.run(|app_handle, event| handle_run_event(app_handle, event));
}

// macOS / iOS: handle the Dock "Reopen" event (click app icon while window is hidden).
#[cfg(any(target_os = "macos", target_os = "ios"))]
fn handle_run_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: RunEvent) {
    match event {
        RunEvent::Reopen { has_visible_windows, .. } => {
            if !has_visible_windows {
                show_main_window(app);
            }
        }
        RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
        }
        _ => {}
    }
}

// Windows / Linux: no Dock, no Reopen variant exists on these targets,
// so reference only the variants that are universally available.
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
fn handle_run_event<R: tauri::Runtime>(_app: &tauri::AppHandle<R>, event: RunEvent) {
    if let RunEvent::ExitRequested { api, .. } = event {
        api.prevent_exit();
    }
}

fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
