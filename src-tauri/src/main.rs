#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod commands;
mod db;
mod models;
mod paths;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use rusqlite::Connection;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub struct AppState {
    pub conn: Mutex<Connection>,
    /// Tracks whether the app-level password gate is still active.
    /// The global quick-capture shortcut is ignored while locked.
    pub locked: AtomicBool,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let conn = db::init(&paths::db_path()).expect("failed to initialize LocalMind database");
            app.manage(AppState {
                conn: Mutex::new(conn),
                locked: AtomicBool::new(true),
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

            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
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
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::add_tag_to_note,
            commands::tags::remove_tag_from_note,
            commands::tags::delete_tag,
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
