use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::{models::Reminder, AppState};

#[tauri::command(rename_all = "snake_case")]
pub fn list_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.note_id, r.due_at, r.fired, r.created_at, COALESCE(n.title,'Untitled')
             FROM reminders r LEFT JOIN notes n ON n.id = r.note_id
             WHERE r.fired=0 ORDER BY r.due_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Reminder {
                id: row.get(0)?,
                note_id: row.get(1)?,
                due_at: row.get(2)?,
                fired: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                note_title: row.get(5)?,
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
pub fn create_reminder(
    note_id: String,
    due_at: String,
    state: State<'_, AppState>,
) -> Result<Reminder, String> {
    state.ensure_unlocked()?;
    chrono::DateTime::parse_from_rfc3339(&due_at)
        .map_err(|_| "Reminder date is invalid".to_string())?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let title: String = conn
        .query_row(
            "SELECT title FROM notes WHERE id=?1",
            params![note_id],
            |row| row.get(0),
        )
        .map_err(|_| "Note no longer exists".to_string())?;
    let item = Reminder {
        id: Uuid::new_v4().to_string(),
        note_id,
        note_title: title,
        due_at,
        fired: false,
        created_at: Utc::now().to_rfc3339(),
    };
    conn.execute(
        "INSERT INTO reminders(id,note_id,due_at,fired,created_at) VALUES(?1,?2,?3,0,?4)",
        params![item.id, item.note_id, item.due_at, item.created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_reminder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM reminders WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn mark_reminder_fired(id: String, state: State<'_, AppState>) -> Result<(), String> {
    // Reminders may be dismissed from a Windows notification while the lock
    // screen is showing, so this bookkeeping must stay available when locked.
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE reminders SET fired=1 WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
