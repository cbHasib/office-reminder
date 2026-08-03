// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::collections::HashSet;
use std::path::PathBuf;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};
use tauri_plugin_autostart::MacosLauncher;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ActiveEvent {
    pub id: String, // Unique key, e.g. "reminder_id@ISOString"
    pub reminder_id: String,
    pub title: String,
    pub description: String,
    pub event_at_ms: i64,
    pub fire_at_ms: i64,
    pub close_at_ms: i64,
    #[serde(rename = "eventAtISO")]
    pub event_at_iso: String,
    pub lead_minutes: i64,
    pub dismissible_during_countdown: bool,
    pub sound_enabled: bool,
    pub sound_name: String,
    pub theme: String,
    pub overlay_position: String,
}

pub struct AppState {
    pub active_events: Mutex<Vec<ActiveEvent>>,
    pub current_overlay: Mutex<Option<ActiveEvent>>,
    pub spawned_event_ids: Mutex<HashSet<String>>,
    /// Occurrences the user explicitly dismissed — persisted so they don't
    /// resurrect after an app restart within their fire window.
    pub dismissed_event_ids: Mutex<HashSet<String>>,
    pub is_quitting: Mutex<bool>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn get_data_path(app: &tauri::AppHandle, file: &str) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push(file);
    Ok(path)
}

fn get_cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    get_data_path(app, "active_events.json")
}

fn get_dismissed_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    get_data_path(app, "dismissed_events.json")
}

/// Write via temp file + rename so a crash/quit mid-write can't truncate the file.
fn write_json_atomic(path: &PathBuf, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_dismissed_ids(app: &tauri::AppHandle) -> HashSet<String> {
    if let Ok(path) = get_dismissed_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(ids) = serde_json::from_str::<HashSet<String>>(&content) {
                return ids;
            }
        }
    }
    HashSet::new()
}

fn save_dismissed_to_disk(app: &tauri::AppHandle, ids: &HashSet<String>) -> Result<(), String> {
    let path = get_dismissed_path(app)?;
    let content = serde_json::to_string(ids).map_err(|e| e.to_string())?;
    write_json_atomic(&path, &content)
}

fn load_active_events(app: &tauri::AppHandle) -> Vec<ActiveEvent> {
    if let Ok(path) = get_cache_path(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                match serde_json::from_str::<Vec<ActiveEvent>>(&content) {
                    Ok(events) => {
                        println!("[Loader] Loaded {} cached events from disk.", events.len());
                        return events;
                    }
                    Err(_) => eprintln!("[Loader Error] Failed to parse active_events.json."),
                }
            } else {
                eprintln!("[Loader Error] Failed to read active_events.json.");
            }
        }
    } else {
        eprintln!("[Loader Error] Failed to get application cache path.");
    }
    Vec::new()
}

fn save_active_events_to_disk(app: &tauri::AppHandle, events: &[ActiveEvent]) -> Result<(), String> {
    let path = get_cache_path(app)?;
    let content = serde_json::to_string(events).map_err(|e| e.to_string())?;
    write_json_atomic(&path, &content)
}

#[tauri::command]
async fn save_active_events(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    events: Vec<ActiveEvent>,
) -> Result<(), String> {
    println!("[IPC] save_active_events: {} events", events.len());
    save_active_events_to_disk(&app, &events)?;

    let id_set: HashSet<String> = events.iter().map(|e| e.id.clone()).collect();
    {
        let mut active = state.active_events.lock().map_err(|_| "Failed to lock active_events")?;
        *active = events;
    }
    // Reconcile the bookkeeping sets with the new list so entries for
    // deleted/edited reminders don't linger (and grow) forever.
    if let Ok(mut spawned) = state.spawned_event_ids.lock() {
        spawned.retain(|id| id_set.contains(id));
    }
    if let Ok(mut dismissed) = state.dismissed_event_ids.lock() {
        let before = dismissed.len();
        dismissed.retain(|id| id_set.contains(id));
        if dismissed.len() != before {
            let _ = save_dismissed_to_disk(&app, &dismissed);
        }
    }
    Ok(())
}

#[tauri::command]
fn dismiss_current_overlay(app: tauri::AppHandle, state: tauri::State<'_, AppState>) {
    let id = state.current_overlay.lock().ok().and_then(|c| c.as_ref().map(|e| e.id.clone()));
    if let Some(id) = id {
        println!("[IPC] dismiss_current_overlay: {}", id);
        if let Ok(mut dismissed) = state.dismissed_event_ids.lock() {
            dismissed.insert(id);
            let _ = save_dismissed_to_disk(&app, &dismissed);
        }
    }
}

#[tauri::command]
fn hide_main_window_cmd(app: tauri::AppHandle) {
    hide_main_window(&app);
}

#[tauri::command]
async fn get_overlay_payload(
    state: tauri::State<'_, AppState>,
) -> Result<ActiveEvent, String> {
    let overlay = state.current_overlay.lock().map_err(|_| "Failed to lock current_overlay")?;
    match &*overlay {
        Some(ev) => {
            println!("[IPC Command] get_overlay_payload returned: '{}' ({})", ev.title, ev.id);
            Ok(ev.clone())
        }
        None => {
            eprintln!("[IPC Command Error] get_overlay_payload called, but current_overlay is None!");
            Err("No active overlay payload".to_string())
        }
    }
}

const OVERLAY_W: f64 = 380.0;
const OVERLAY_H: f64 = 110.0;

fn overlay_position(app: &tauri::AppHandle, position: &str) -> (f64, f64) {
    // Prefer the monitor the cursor is on (where the user is working);
    // fall back to the primary monitor.
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());

    let monitor = match monitor {
        Some(m) => m,
        None => return (100.0, 100.0),
    };

    let sf = monitor.scale_factor();
    let m_pos = monitor.position();
    let m_size = monitor.size();

    let origin_x = (m_pos.x as f64) / sf;
    let origin_y = (m_pos.y as f64) / sf;
    let screen_w = (m_size.width as f64) / sf;
    let screen_h = (m_size.height as f64) / sf;

    let screen_margin = 18.0;
    let bottom_dock_padding = 60.0;

    let right = screen_w - OVERLAY_W - screen_margin;
    let center = (screen_w - OVERLAY_W) / 2.0;
    let top = screen_margin;
    let bottom = screen_h - OVERLAY_H - screen_margin - bottom_dock_padding;

    let (x, y) = match position {
        "top-right" => (right, top),
        "top-left" => (screen_margin, top),
        "top-center" => (center, top),
        "bottom-right" => (right, bottom),
        "bottom-left" => (screen_margin, bottom),
        "bottom-center" => (center, bottom),
        _ => (right, top),
    };
    (origin_x + x, origin_y + y)
}

fn spawn_scheduler_loop(app: tauri::AppHandle) {
    // Guards against scheduling a second overlay build while one is still
    // being created on the main thread (the label check alone races: the
    // window only becomes visible to get_webview_window after build).
    let spawn_in_flight = Arc::new(AtomicBool::new(false));

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));

            let now = now_ms();
            let state = match app.try_state::<AppState>() {
                Some(s) => s,
                None => continue,
            };

            // Watchdog: auto-close is JS-driven inside the overlay webview; if
            // that webview hung or crashed, the window would linger forever and
            // block every future reminder. Force-close well past close time.
            if let Some(win) = app.get_webview_window("reminder-overlay") {
                let stale = state.current_overlay.lock().ok()
                    .and_then(|c| c.as_ref().map(|e| e.close_at_ms))
                    .map(|close_at| now > close_at + 60_000)
                    .unwrap_or(false);
                if stale {
                    eprintln!("[Scheduler] Overlay stuck past close time — force closing.");
                    let _ = win.close();
                }
            }

            let event_to_fire: Option<ActiveEvent> = {
                let mut active = match state.active_events.lock() {
                    Ok(a) => a,
                    Err(_) => continue,
                };
                if active.is_empty() {
                    continue;
                }

                let mut spawned = match state.spawned_event_ids.lock() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let mut dismissed = match state.dismissed_event_ids.lock() {
                    Ok(d) => d,
                    Err(_) => continue,
                };

                let before = active.len();
                let dismissed_before = dismissed.len();
                active.retain(|ev| {
                    if now > ev.close_at_ms {
                        spawned.remove(&ev.id);
                        dismissed.remove(&ev.id);
                        false
                    } else {
                        true
                    }
                });
                if active.len() != before {
                    println!("[Scheduler] Pruned {} expired event(s).", before - active.len());
                    let _ = save_active_events_to_disk(&app, &active);
                    if dismissed.len() != dismissed_before {
                        let _ = save_dismissed_to_disk(&app, &dismissed);
                    }
                }

                // Events are stored sorted by fire time; pick the first due one.
                active.iter()
                    .find(|ev| {
                        now >= ev.fire_at_ms
                            && now <= ev.close_at_ms
                            && !spawned.contains(&ev.id)
                            && !dismissed.contains(&ev.id)
                    })
                    .cloned()
            };

            if let Some(ev) = event_to_fire {
                if app.get_webview_window("reminder-overlay").is_some()
                    || spawn_in_flight.swap(true, Ordering::SeqCst)
                {
                    continue;
                }

                println!("[Scheduler] Firing overlay for '{}' ({})", ev.title, ev.id);

                if let Ok(mut spawned) = state.spawned_event_ids.lock() {
                    spawned.insert(ev.id.clone());
                }
                if let Ok(mut current) = state.current_overlay.lock() {
                    *current = Some(ev.clone());
                }

                let (pos_x, pos_y) = overlay_position(&app, ev.overlay_position.as_str());

                let app_clone = app.clone();
                let in_flight = spawn_in_flight.clone();
                let ev_id = ev.id.clone();
                let scheduled = app.run_on_main_thread(move || {
                    let builder = tauri::WebviewWindowBuilder::new(
                        &app_clone,
                        "reminder-overlay",
                        tauri::WebviewUrl::App("overlay.html".into())
                    )
                    .title("Reminder")
                    .inner_size(OVERLAY_W, OVERLAY_H)
                    .position(pos_x, pos_y)
                    .decorations(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .transparent(true)
                    .focused(false)
                    .shadow(false);

                    // tao#561: on Linux GTK, resizable(false) forces a ~200px minimum
                    // height, stretching the overlay. Keep the window resizable there
                    // and lock the size via min == max instead.
                    #[cfg(target_os = "linux")]
                    let builder = builder
                        .resizable(true)
                        .min_inner_size(OVERLAY_W, OVERLAY_H)
                        .max_inner_size(OVERLAY_W, OVERLAY_H);
                    #[cfg(not(target_os = "linux"))]
                    let builder = builder.resizable(false);

                    match builder.build() {
                        Ok(_win) => {
                            #[cfg(target_os = "linux")]
                            {
                                let _ = _win.set_size(tauri::LogicalSize::new(OVERLAY_W, OVERLAY_H));
                                let _ = _win.set_position(tauri::LogicalPosition::new(pos_x, pos_y));
                            }
                        }
                        Err(e) => {
                            eprintln!("[Scheduler Error] Failed to build overlay window: {:?}", e);
                            // Roll back so the occurrence isn't silently lost — the
                            // next tick will retry while it's still inside its window.
                            if let Some(state) = app_clone.try_state::<AppState>() {
                                if let Ok(mut spawned) = state.spawned_event_ids.lock() {
                                    spawned.remove(&ev_id);
                                }
                                if let Ok(mut current) = state.current_overlay.lock() {
                                    *current = None;
                                }
                            }
                        }
                    }
                    in_flight.store(false, Ordering::SeqCst);
                });
                if scheduled.is_err() {
                    spawn_in_flight.store(false, Ordering::SeqCst);
                }
            }
        }
    });
}

/// True when this process was launched by the OS login-item / autostart entry.
fn launched_at_login() -> bool {
    std::env::args().any(|a| a == "--autostart")
}

fn main() {
    let app = tauri::Builder::default()
        // Must be the first plugin: a second app launch (e.g. clicking the
        // launcher while the tray instance is running) forwards here and exits,
        // instead of starting a duplicate process with its own overlay.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            println!("[SingleInstance] Second launch detected — showing existing window.");
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // Set macOS activation policy to Accessory to hide the Dock icon and run purely in system tray
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                use tauri::menu::{MenuBuilder, SubmenuBuilder};

                use tauri::menu::AboutMetadata;

                let about_metadata = AboutMetadata {
                    name: Some("Office Reminder".to_string()),
                    version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    copyright: Some("© 2026 Hasibul Hasan (hasib.me)".to_string()),
                    authors: Some(vec!["Hasibul Hasan".to_string()]),
                    website: Some("https://github.com/cbHasib/office-reminder".to_string()),
                    website_label: Some("GitHub Repository".to_string()),
                    comments: Some("A premium, unthrottled desktop reminder utility built by Hasibul Hasan and designed by Antigravity to help you stay focused and never miss important events.".to_string()),
                    ..Default::default()
                };

                // Create custom App submenu (no Quit!)
                let app_submenu = SubmenuBuilder::new(app, "Office Reminder")
                    .about(Some(about_metadata))
                    .separator()
                    .hide()
                    .hide_others()
                    .build()?;

                // Create standard Edit submenu so Copy/Paste still works
                let edit_submenu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[&app_submenu, &edit_submenu])
                    .build()?;

                app.set_menu(menu)?;
            }

            // Register updater plugin
            #[cfg(desktop)]
            let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());

            // Initialize active events state
            let cached_events = load_active_events(app.handle());
            let cached_ids: HashSet<String> = cached_events.iter().map(|e| e.id.clone()).collect();
            let mut dismissed = load_dismissed_ids(app.handle());
            dismissed.retain(|id| cached_ids.contains(id));
            app.manage(AppState {
                active_events: Mutex::new(cached_events),
                current_overlay: Mutex::new(None),
                spawned_event_ids: Mutex::new(HashSet::new()),
                dismissed_event_ids: Mutex::new(dismissed),
                is_quitting: Mutex::new(false),
            });

            // Spawn native timer loop
            spawn_scheduler_loop(app.handle().clone());

            // The main window is configured hidden (`visible: false`). Show it
            // only for manual launches — autostart runs stay in the tray.
            if launched_at_login() {
                println!("[Startup] Launched at login — staying in background.");
            } else {
                show_main_window(app.handle());
            }

            // Tray menu: show, settings, quit.
            let show_item     = MenuItem::with_id(app, "show",     "Show window",          true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Open settings",        true, None::<&str>)?;
            let quit_item     = MenuItem::with_id(app, "quit",     "Quit Office Reminder", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" | "settings" => {
                        println!("[Tray] Menu item clicked: {}", event.id.as_ref());
                        show_main_window(app);
                    }
                    "quit" => {
                        println!("[Tray] Quit menu item clicked. Exiting app cleanly.");
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut quitting) = state.is_quitting.lock() {
                                *quitting = true;
                            }
                        }
                        // Go through Tauri's shutdown (not process::exit) so
                        // in-flight disk writes and teardown complete.
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up, ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let visible = win.is_visible().unwrap_or(false);
                            if visible {
                                println!("[Tray] Left-clicked tray icon. Hiding main window.");
                                hide_main_window(app);
                            } else {
                                println!("[Tray] Left-clicked tray icon. Showing main window.");
                                show_main_window(app);
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    println!("[Window] Close requested on main window. Preventing close and hiding window to tray.");
                    api.prevent_close();
                    hide_main_window(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_active_events,
            get_overlay_payload,
            dismiss_current_overlay,
            hide_main_window_cmd,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Office Reminder");

    app.run(|app_handle, event| handle_run_event(app_handle, event));
}

fn handle_run_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: RunEvent) {
    match event {
        RunEvent::ExitRequested { api, .. } => {
            if let Some(state) = app.try_state::<AppState>() {
                let quitting = state.is_quitting.lock().map(|q| *q).unwrap_or(false);
                if !quitting {
                    api.prevent_exit();
                    println!("[App Lifecycle] Exit requested (Cmd+Q or similar). Preventing exit and hiding main window.");
                    hide_main_window(app);
                } else {
                    println!("[App Lifecycle] Exit requested and is_quitting is true. Proceeding with clean termination.");
                }
            }
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        RunEvent::Reopen { has_visible_windows, .. } => {
            if !has_visible_windows {
                println!("[App Lifecycle] Reopen requested. Showing main window.");
                show_main_window(app);
            }
        }
        _ => {}
    }
}

fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        println!("[Window] Main window focused and visible.");
    } else {
        eprintln!("[Window Error] show_main_window called, but main window was not found.");
    }
}

fn hide_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
        #[cfg(target_os = "macos")]
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        println!("[Window] Main window hidden, accessory mode active.");
    }
}
