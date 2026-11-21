use std::{fs, path::Path};

use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::{models::Attachment, paths, AppState};

fn mime_for(name: &str) -> &'static str {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" | "md" => "text/plain",
        "json" => "application/json",
        "zip" => "application/zip",
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        _ => "application/octet-stream",
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_attachments(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Attachment>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM attachments WHERE note_id=?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![note_id], |row| {
            Ok(Attachment {
                id: row.get("id")?,
                note_id: row.get("note_id")?,
                filename: row.get("filename")?,
                stored_path: row.get("stored_path")?,
                mime: row.get("mime")?,
                size: row.get("size")?,
                created_at: row.get("created_at")?,
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
pub fn attach_file(
    note_id: String,
    source_path: String,
    state: State<'_, AppState>,
) -> Result<Attachment, String> {
    let source = Path::new(&source_path);
    if !source.is_file() {
        return Err("Source file does not exist".into());
    }
    let filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string();
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let id = Uuid::new_v4().to_string();
    let stored_name = if ext.is_empty() {
        id.clone()
    } else {
        format!("{}.{}", id, ext)
    };
    let target = paths::attachments_dir().join(&stored_name);
    fs::copy(source, &target).map_err(|e| e.to_string())?;
    let size = fs::metadata(&target).map(|m| m.len() as i64).unwrap_or(0);

    let item = Attachment {
        id: id.clone(),
        note_id: note_id.clone(),
        filename,
        stored_path: target.to_string_lossy().to_string(),
        mime: mime_for(&stored_name).to_string(),
        size,
        created_at: Utc::now().to_rfc3339(),
    };

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO attachments(id,note_id,filename,stored_path,mime,size,created_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![
            item.id,
            item.note_id,
            item.filename,
            item.stored_path,
            item.mime,
            item.size,
            item.created_at
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command(rename_all = "snake_case")]
pub fn detach_attachment(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let path: Option<String> = conn
        .query_row(
            "SELECT stored_path FROM attachments WHERE id=?1",
            params![id],
            |row| row.get(0),
        )
        .ok();
    if let Some(p) = path {
        let _ = fs::remove_file(&p);
    }
    conn.execute("DELETE FROM attachments WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
