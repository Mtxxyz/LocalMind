use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::{db, models::Tag, AppState};

#[tauri::command(rename_all = "snake_case")]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut tags = Vec::new();
    for row in rows {
        tags.push(row.map_err(|e| e.to_string())?);
    }
    Ok(tags)
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_tag(name: String, state: State<'_, AppState>) -> Result<Tag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let clean = name.trim().to_lowercase();
    if clean.is_empty() {
        return Err("Tag name cannot be empty".into());
    }
    if let Ok(existing) = conn.query_row(
        "SELECT id, name FROM tags WHERE name=?1",
        params![clean],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        },
    ) {
        return Ok(existing);
    }
    let tag = Tag {
        id: Uuid::new_v4().to_string(),
        name: clean,
    };
    conn.execute("INSERT INTO tags(id,name) VALUES(?1,?2)", params![tag.id, tag.name])
        .map_err(|e| e.to_string())?;
    Ok(tag)
}

#[tauri::command(rename_all = "snake_case")]
pub fn add_tag_to_note(
    note_id: String,
    tag_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO note_tags(note_id,tag_id) VALUES(?1,?2)",
        params![note_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    db::reindex_note(&conn, &note_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove_tag_from_note(
    note_id: String,
    tag_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM note_tags WHERE note_id=?1 AND tag_id=?2",
        params![note_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    db::reindex_note(&conn, &note_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_tag(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let affected: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT note_id FROM note_tags WHERE tag_id=?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(Result::ok).collect()
    };
    conn.execute("DELETE FROM note_tags WHERE tag_id=?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    for note_id in affected {
        db::reindex_note(&conn, &note_id).map_err(|e| e.to_string())?;
    }
    Ok(())
}
