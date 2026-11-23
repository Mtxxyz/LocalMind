use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::State;
use uuid::Uuid;

use crate::{
    commands::attachments::remove_attachment_file,
    db,
    models::Note,
    AppState,
};

#[tauri::command(rename_all = "snake_case")]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], db::note_from_row)
        .map_err(|e| e.to_string())?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_note(id: String, state: State<'_, AppState>) -> Result<Option<Note>, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM notes WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row(params![id], db::note_from_row)
        .optional()
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_note(
    title: String,
    body: String,
    folder_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let note = Note {
        id: Uuid::new_v4().to_string(),
        title,
        body,
        folder_id,
        pinned: false,
        archived: false,
        trashed: false,
        created_at: now.clone(),
        updated_at: now,
    };
    conn.execute(
        "INSERT INTO notes(id,title,body,folder_id,pinned,archived,trashed,created_at,updated_at)
         VALUES(?1,?2,?3,?4,0,0,0,?5,?5)",
        params![note.id, note.title, note.body, note.folder_id, note.updated_at],
    )
    .map_err(|e| e.to_string())?;
    db::fts_insert(&conn, &note).map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_note(
    id: String,
    title: String,
    body: String,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET title=?1, body=?2, updated_at=?3 WHERE id=?4",
        params![title, body, now, id],
    )
    .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM notes WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let note: Note = stmt
        .query_row(params![id], db::note_from_row)
        .map_err(|e| e.to_string())?;
    db::fts_insert(&conn, &note).map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command(rename_all = "snake_case")]
pub fn move_note_to_folder(
    id: String,
    folder_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET folder_id=?1, updated_at=?2 WHERE id=?3",
        params![folder_id, Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn set_flag(id: &str, flag: &str, value: bool, state: &State<'_, AppState>) -> Result<(), String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "UPDATE notes SET {}=?1, updated_at=?2 WHERE id=?3",
        flag
    );
    conn.execute(
        &sql,
        params![if value { 1 } else { 0 }, Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_note_pinned(id: String, value: bool, state: State<'_, AppState>) -> Result<(), String> {
    set_flag(&id, "pinned", value, &state)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_note_archived(id: String, value: bool, state: State<'_, AppState>) -> Result<(), String> {
    set_flag(&id, "archived", value, &state)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_note_trashed(id: String, value: bool, state: State<'_, AppState>) -> Result<(), String> {
    set_flag(&id, "trashed", value, &state)
}

#[tauri::command(rename_all = "snake_case")]
pub fn empty_trash(state: State<'_, AppState>) -> Result<(), String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM notes WHERE trashed=1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(Result::ok).collect()
    };
    for id in ids {
        let mut file_stmt = conn
            .prepare("SELECT stored_path FROM attachments WHERE note_id=?1")
            .map_err(|e| e.to_string())?;
        let paths: Vec<String> = file_stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect();
        conn.execute("DELETE FROM attachments WHERE note_id=?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM reminders WHERE note_id=?1", params![id])
            .map_err(|e| e.to_string())?;
        db::fts_delete(&conn, &id).map_err(|e| e.to_string())?;
        // Remove files only after the metadata deletes succeed.
        for path in paths {
            remove_attachment_file(&path);
        }
    }
    conn.execute("DELETE FROM notes WHERE trashed=1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    state.ensure_unlocked()?;
    let fts = db::fts_query(&query);
    if fts.is_empty() {
        return Ok(Vec::new());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT n.* FROM notes n
             JOIN notes_fts ON notes_fts.id = n.id
             WHERE notes_fts MATCH ?1
             ORDER BY n.pinned DESC, n.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![fts], db::note_from_row)
        .map_err(|e| e.to_string())?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
