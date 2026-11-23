#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod commands;
mod db;
mod models;
mod paths;

use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};

use chrono::Utc;
use rusqlite::Connection;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;

pub struct AppState {
    pub conn: Mutex<Connection>,
    /// Tracks whether the app-level password gate is still active.
    /// The global quick-capture shortcut is ignored while locked.
    pub locked: AtomicBool,
}

impl AppState {
    pub fn ensure_unlocked(&self) -> Result<(), String> {
        if self.locked.load(Ordering::SeqCst) {
            Err("LocalMind is locked".to_string())
        } else {
            Ok(())
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let conn = db::init(&paths::db_path()).expect("failed to initialize LocalMind database");
            app.manage(AppState {
                conn: Mutex::new(conn),
                locked: AtomicBool::new(true),
            });

            // Native reminder scheduling stays alive even when the window is
            // hidden to the tray or the lock screen is showing.
            let scheduler = app.handle().clone();
            let mut notified: HashSet<String> = HashSet::new();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(5));
                let state = scheduler.state::<AppState>();
                let due: Vec<models::Reminder> = {
                    let Ok(conn) = state.conn.lock() else { continue };
                    let mut stmt = match conn.prepare(
                        "SELECT r.id, r.note_id, r.due_at, r.fired, r.created_at,
                                COALESCE(n.title,'Untitled')
                         FROM reminders r LEFT JOIN notes n ON n.id = r.note_id
                         WHERE r.fired=0",
                    ) {
                        Ok(stmt) => stmt,
                        Err(_) => continue,
                    };
                    let rows = match stmt.query_map([], |row| {
                        Ok(models::Reminder {
                            id: row.get(0)?,
                            note_id: row.get(1)?,
                            due_at: row.get(2)?,
                            fired: row.get::<_, i64>(3)? != 0,
                            created_at: row.get(4)?,
                            note_title: row.get(5)?,
                        })
                    }) {
                        Ok(rows) => rows,
                        Err(_) => continue,
                    };
                    rows.filter_map(Result::ok)
                        .filter(|r| {
                            !notified.contains(&r.id)
                                && chrono::DateTime::parse_from_rfc3339(&r.due_at)
                                    .map(|due| due.with_timezone(&Utc) <= Utc::now())
                                    .unwrap_or(false)
                        })
                        .collect()
                };
                for reminder in due {
                    // Native Windows notification comes from Rust so it still fires
                    // while the lock screen is showing or the window is in the tray.
                    let _ = scheduler
                        .notification()
                        .builder()
                        .title("LocalMind reminder")
                        .body(format!("{} · {}", reminder.note_title, reminder.due_at))
                        .extra("noteId", &reminder.note_id)
                        .extra("reminderId", &reminder.id)
                        .show();
                    let _ = scheduler.emit("reminder-due", &reminder);
                    // Leave fired=0 until the UI dismisses the toast. If the event is
                    // missed while the frontend listener starts, the polling fallback
                    // can still recover it from list_reminders.
                    notified.insert(reminder.id);
                }
            });

            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut("CommandOrControl+N", move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed
                        && !handle.state::<AppState>().locked.load(Ordering::SeqCst)
                    {
                        if let Some(window) = handle.get_webview_window("capture") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })?;

            // Build the system tray icon + menu.
            let show_item = MenuItem::with_id(app, "show", "Show LocalMind", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_skip_taskbar(false);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // Let the frontend flush its debounced save first; it calls
                        // exit(0) when the flush (or its failure) is handled.
                        let _ = app.emit("flush-and-quit", ());
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
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_skip_taskbar(false);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            // Keep the tray icon alive for the whole app lifetime. Dropping it
            // removes the icon, which would strand a hidden main window.
            app.manage(tray);

            // Hide-to-tray on close instead of quitting.
            if let Some(main) = app.get_webview_window("main") {
                let window = main.clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        // Let the frontend flush its debounced save, then hide.
                        let _ = window.emit("flush-and-hide", ());
                    }
                });
                let _ = main.set_skip_taskbar(false);
                let _ = main.show();
                let _ = main.set_focus();
            }

            // The quick-capture window has native decorations. Keep it alive when
            // its X is clicked so the global shortcut can show it again.
            if let Some(capture) = app.get_webview_window("capture") {
                let window = capture.clone();
                capture.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::list_notes,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::move_note_to_folder,
            commands::notes::set_note_pinned,
            commands::notes::set_note_archived,
            commands::notes::set_note_trashed,
            commands::notes::empty_trash,
            commands::notes::search_notes,
            commands::folders::list_folders,
            commands::folders::create_folder,
            commands::folders::update_folder,
            commands::folders::delete_folder,
            commands::attachments::list_attachments,
            commands::attachments::attach_file,
            commands::attachments::detach_attachment,
            commands::reminders::list_reminders,
            commands::reminders::create_reminder,
            commands::reminders::delete_reminder,
            commands::reminders::mark_reminder_fired,
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::has_password,
            commands::settings::set_password,
            commands::settings::verify_password,
            commands::settings::remove_password,
            commands::settings::get_data_path,
            commands::settings::set_app_locked,
            commands::exporter::export_markdown,
            commands::exporter::export_folder,
            commands::exporter::export_backup,
            commands::exporter::import_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LocalMind");
}