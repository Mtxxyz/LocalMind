use std::sync::atomic::Ordering;

use rusqlite::params;
use tauri::State;

use crate::{auth, models::Setting, paths, AppState};

#[tauri::command(rename_all = "snake_case")]
pub fn get_settings(state: State<'_, AppState>) -> Result<Vec<Setting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings ORDER BY key")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn has_password(state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let hash: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key='password_hash'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    Ok(!hash.trim().is_empty())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_password(password: String, state: State<'_, AppState>) -> Result<(), String> {
    if password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }
    let hash = auth::hash_password(&password);
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings(key,value) VALUES('password_hash',?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![hash],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn verify_password(password: String, state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let hash: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key='password_hash'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    if hash.trim().is_empty() {
        return Ok(true);
    }
    Ok(auth::verify_password(&password, &hash))
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove_password(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE settings SET value='' WHERE key='password_hash'",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_data_path() -> String {
    paths::data_dir().to_string_lossy().to_string()
}

/// Called by the frontend once the password gate has been satisfied.
#[tauri::command(rename_all = "snake_case")]
pub fn set_app_locked(locked: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.locked.store(locked, Ordering::SeqCst);
    Ok(())
}
