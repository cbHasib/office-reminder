// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
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
    pub is_quitting: Mutex<bool>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn get_cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("active_events.json");
    Ok(path)
}

fn load_active_events(app: &tauri::AppHandle) -> Vec<ActiveEvent> {
    println!("[Loader] Loading cached active events from disk...");
    if let Ok(path) = get_cache_path(app) {
        println!("[Loader] Cache path: {:?}", path);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(events) = serde_json::from_str::<Vec<ActiveEvent>>(&content) {
                    println!("[Loader] Successfully loaded {} cached events from disk.", events.len());
                    return events;
                } else {
                    eprintln!("[Loader Error] Failed to parse active_events.json JSON content.");
                }
            } else {
                eprintln!("[Loader Error] Failed to read active_events.json file.");
            }
        } else {
            println!("[Loader] No cached active events file found. Starting fresh.");
        }
    } else {
        eprintln!("[Loader Error] Failed to get application cache path.");
    }
    Vec::new()
}

fn save_active_events_to_disk(app: &tauri::AppHandle, events: &[ActiveEvent]) -> Result<(), String> {
    let path = get_cache_path(app)?;
    let content = serde_json::to_string(events).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    println!("[Cache] Saved {} active events to disk at {:?}", events.len(), path);
    Ok(())
}

#[tauri::command]
async fn save_active_events(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    events: Vec<ActiveEvent>,
) -> Result<(), String> {
    println!("[IPC Command] save_active_events called with {} events", events.len());
    for (i, ev) in events.iter().enumerate() {
        println!("  Event [{}]: '{}' (ID: {}), fire_at_ms: {}", i, ev.title, ev.id, ev.fire_at_ms);
    }
    {
        let mut active = state.active_events.lock().map_err(|_| "Failed to lock active_events")?;
        *active = events.clone();
    }
    save_active_events_to_disk(&app, &events)?;
    println!("[IPC Command] save_active_events completed successfully.");
    Ok(())
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

fn spawn_scheduler_loop(app: tauri::AppHandle) {
    println!("[Scheduler] Initializing native background scheduler loop thread...");
    std::thread::spawn(move || {
        println!("[Scheduler] Background scheduler loop thread started.");
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            
            let now = now_ms();
            let state = match app.try_state::<AppState>() {
                Some(s) => s,
                None => {
                    eprintln!("[Scheduler Error] AppState state could not be resolved.");
                    continue;
                }
            };
            
            let mut events_to_fire = Vec::new();
            let mut changed = false;
            
            {
                let mut active = match state.active_events.lock() {
                    Ok(a) => a,
                    Err(_) => {
                        eprintln!("[Scheduler Error] Failed to lock active_events Mutex.");
                        continue;
                    }
                };
                
                let mut spawned = match state.spawned_event_ids.lock() {
                    Ok(s) => s,
                    Err(_) => {
                        eprintln!("[Scheduler Error] Failed to lock spawned_event_ids Mutex.");
                        continue;
                    }
                };
                
                let original_count = active.len();
                active.retain(|ev| {
                    if now > ev.close_at_ms {
                        spawned.remove(&ev.id);
                        changed = true;
                        println!("[Scheduler] Pruned expired event: '{}' (ID: {})", ev.title, ev.id);
                        false
                    } else {
                        true
                    }
                });
                
                for ev in active.iter() {
                    if now >= ev.fire_at_ms && now <= ev.close_at_ms && !spawned.contains(&ev.id) {
                        println!("[Scheduler] Event ready to fire: '{}' (ID: {}). Fire time: {}, Close time: {}, Current time: {}", ev.title, ev.id, ev.fire_at_ms, ev.close_at_ms, now);
                        events_to_fire.push(ev.clone());
                    }
                }
                
                if changed {
                    println!("[Scheduler] Active events list updated. Size changed from {} to {}.", original_count, active.len());
                    let _ = save_active_events_to_disk(&app, &active);
                }
            }
            
            if !events_to_fire.is_empty() {
                if app.get_webview_window("reminder-overlay").is_none() {
                    let ev = &events_to_fire[0];
                    println!("[Scheduler] Spawning reminder overlay window for event '{}'", ev.title);
                    
                    if let Ok(mut spawned) = state.spawned_event_ids.lock() {
                        spawned.insert(ev.id.clone());
                    }
                    
                    if let Ok(mut current) = state.current_overlay.lock() {
                        *current = Some(ev.clone());
                    }
                    
                    let mut pos_x = 100.0;
                    let mut pos_y = 100.0;
                    
                    if let Ok(Some(monitor)) = app.primary_monitor() {
                        let sf = monitor.scale_factor();
                        let m_size = monitor.size();
                        
                        let screen_w = (m_size.width as f64) / sf;
                        let screen_h = (m_size.height as f64) / sf;
                        
                        let overlay_w = 380.0;
                        let overlay_h = 110.0;
                        let screen_margin = 18.0;
                        let bottom_dock_padding = 60.0;
                        
                        let right = screen_w - overlay_w - screen_margin;
                        let center = (screen_w - overlay_w) / 2.0;
                        let top = screen_margin;
                        let bottom = screen_h - overlay_h - screen_margin - bottom_dock_padding;
                        
                        let (logical_x, logical_y) = match ev.overlay_position.as_str() {
                            "top-right" => (right, top),
                            "top-left" => (screen_margin, top),
                            "top-center" => (center, top),
                            "bottom-right" => (right, bottom),
                            "bottom-left" => (screen_margin, bottom),
                            "bottom-center" => (center, bottom),
                            _ => (right, top),
                        };
                        
                        pos_x = logical_x;
                        pos_y = logical_y;
                    }
                    
                    println!("[Scheduler] Spawn position calculated: ({}, {})", pos_x, pos_y);
                    let app_clone = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        let build_res = tauri::WebviewWindowBuilder::new(
                            &app_clone,
                            "reminder-overlay",
                            tauri::WebviewUrl::App("overlay.html".into())
                        )
                        .title("Reminder")
                        .inner_size(380.0, 110.0)
                        .position(pos_x, pos_y)
                        .resizable(false)
                        .decorations(false)
                        .always_on_top(true)
                        .skip_taskbar(true)
                        .transparent(true)
                        .focused(false)
                        .shadow(false)
                        .build();
                        
                        match build_res {
                            Ok(_) => println!("[Scheduler] Overlay window successfully spawned and visible."),
                            Err(e) => eprintln!("[Scheduler Error] Failed to build overlay window: {:?}", e),
                        }
                    });
                }
            }
        }
    });
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
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
                    copyright: Some("© 2026 Hasib & Antigravity".to_string()),
                    authors: Some(vec!["cbHasib".to_string(), "Antigravity".to_string()]),
                    website: Some("https://github.com/cbHasib/office-reminder".to_string()),
                    website_label: Some("GitHub Repository".to_string()),
                    comments: Some("A premium, unthrottled desktop reminder utility built by Hasib and designed by Antigravity to help you stay focused and never miss important events.".to_string()),
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
            app.manage(AppState {
                active_events: Mutex::new(cached_events),
                current_overlay: Mutex::new(None),
                spawned_event_ids: Mutex::new(HashSet::new()),
                is_quitting: Mutex::new(false),
            });

            // Spawn native timer loop
            spawn_scheduler_loop(app.handle().clone());

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
                        std::process::exit(0);
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
                                let _ = win.hide();
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
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_active_events,
            get_overlay_payload,
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
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.hide();
                    }
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
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        println!("[Window] Main window focused and visible.");
    } else {
        eprintln!("[Window Error] show_main_window called, but main window was not found.");
    }
}
