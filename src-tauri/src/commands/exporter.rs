use std::fs;

use rusqlite::{params, Connection};
use tauri::State;

use crate::{
    db,
    models::{Attachment, Backup, Folder, Note, NoteTag, Reminder, Setting, Tag},
    AppState,
};

fn write_markdown(conn: &Connection, note_ids: &[String], target_path: &str) -> Result<(), String> {
    let mut out = String::new();
    for (index, id) in note_ids.iter().enumerate() {
        let mut stmt = conn
            .prepare("SELECT * FROM notes WHERE id=?1")
            .map_err(|e| e.to_string())?;
        let note: Note = stmt
            .query_row(params![id], db::note_from_row)
            .map_err(|e| e.to_string())?;
        let tags = db::fetch_tags(&conn, &note.id).map_err(|e| e.to_string())?;
        let tag_line = tags
            .iter()
            .map(|t| t.name.clone())
            .collect::<Vec<_>>()
            .join(", ");

        if index > 0 {
            out.push_str("\n\n---\n\n");
        }
        out.push_str("---\n");
        out.push_str(&format!("title: \"{}\"\n", note.title.replace('"', "\\\"")));
        out.push_str(&format!("created: {}\n", note.created_at));
        out.push_str(&format!("updated: {}\n", note.updated_at));
        out.push_str(&format!("tags: [{}]\n", tag_line));
        out.push_str("---\n\n");
        out.push_str(&format!("# {}\n\n", note.title));
        out.push_str(&note.body);
        out.push('\n');
    }
    fs::write(target_path, out).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn export_markdown(
    note_ids: Vec<String>,
    target_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    write_markdown(&conn, &note_ids, &target_path)
}

/// Export every non-trashed note in a folder, including its subfolders.
#[tauri::command(rename_all = "snake_case")]
pub fn export_folder(
    folder_id: String,
    target_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut pending = vec![folder_id];
    let mut note_ids = Vec::new();
    while let Some(current) = pending.pop() {
        if let Ok(mut stmt) = conn.prepare("SELECT id FROM folders WHERE parent_id=?1") {
            if let Ok(rows) = stmt.query_map(params![current], |r| r.get::<_, String>(0)) {
                for row in rows.flatten() {
                    pending.push(row);
                }
            }
        }
        if let Ok(mut stmt) = conn.prepare(
            "SELECT id FROM notes WHERE folder_id=?1 AND trashed=0
             ORDER BY pinned DESC, updated_at DESC",
        ) {
            if let Ok(rows) = stmt.query_map(params![current], |r| r.get::<_, String>(0)) {
                for row in rows.flatten() {
                    note_ids.push(row);
                }
            }
        }
    }
    write_markdown(&conn, &note_ids, &target_path)
}

#[tauri::command(rename_all = "snake_case")]
pub fn export_backup(target_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut backup = Backup::default();

    {
        let mut stmt = conn
            .prepare("SELECT * FROM notes")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], db::note_from_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.notes.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT id,name,parent_id,color,sort_order FROM folders")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    color: row.get(3)?,
                    sort_order: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.folders.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT id,name FROM tags")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.tags.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT note_id,tag_id FROM note_tags")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(NoteTag {
                    note_id: row.get(0)?,
                    tag_id: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.note_tags.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT * FROM attachments")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
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
        for row in rows {
            backup.attachments.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT * FROM reminders")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Reminder {
                    id: row.get("id")?,
                    note_id: row.get("note_id")?,
                    due_at: row.get("due_at")?,
                    fired: row.get::<_, i64>("fired")? != 0,
                    created_at: row.get("created_at")?,
                    note_title: String::new(),
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.reminders.push(row.map_err(|e| e.to_string())?);
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT key,value FROM settings")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Setting {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            backup.settings.push(row.map_err(|e| e.to_string())?);
        }
    }

    let json = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    fs::write(&target_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn import_backup(source_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let raw = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    let backup: Backup = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute_batch(
        "DELETE FROM notes_fts;
         DELETE FROM note_tags;
         DELETE FROM attachments;
         DELETE FROM reminders;
         DELETE FROM notes;
         DELETE FROM folders;
         DELETE FROM tags;
         DELETE FROM settings;",
    )
    .map_err(|e| e.to_string())?;

    for s in &backup.settings {
        tx.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)",
            params![s.key, s.value],
        )
        .map_err(|e| e.to_string())?;
    }
    for f in &backup.folders {
        tx.execute(
            "INSERT INTO folders(id,name,parent_id,color,sort_order) VALUES(?1,?2,?3,?4,?5)",
            params![f.id, f.name, f.parent_id, f.color, f.sort_order],
        )
        .map_err(|e| e.to_string())?;
    }
    for t in &backup.tags {
        tx.execute(
            "INSERT INTO tags(id,name) VALUES(?1,?2)",
            params![t.id, t.name],
        )
        .map_err(|e| e.to_string())?;
    }
    for n in &backup.notes {
        tx.execute(
            "INSERT INTO notes(id,title,body,folder_id,pinned,archived,trashed,created_at,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                n.id, n.title, n.body, n.folder_id, n.pinned, n.archived, n.trashed, n.created_at,
                n.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    for nt in &backup.note_tags {
        tx.execute(
            "INSERT OR IGNORE INTO note_tags(note_id,tag_id) VALUES(?1,?2)",
            params![nt.note_id, nt.tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    for a in &backup.attachments {
        tx.execute(
            "INSERT INTO attachments(id,note_id,filename,stored_path,mime,size,created_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![a.id, a.note_id, a.filename, a.stored_path, a.mime, a.size, a.created_at],
        )
        .map_err(|e| e.to_string())?;
    }
    for r in &backup.reminders {
        tx.execute(
            "INSERT INTO reminders(id,note_id,due_at,fired,created_at) VALUES(?1,?2,?3,?4,?5)",
            params![r.id, r.note_id, r.due_at, r.fired, r.created_at],
        )
        .map_err(|e| e.to_string())?;
    }
    for n in &backup.notes {
        let tag_text = backup
            .note_tags
            .iter()
            .filter(|nt| nt.note_id == n.id)
            .filter_map(|nt| backup.tags.iter().find(|t| t.id == nt.tag_id))
            .map(|t| t.name.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        tx.execute(
            "INSERT OR REPLACE INTO notes_fts(id,title,body,tags) VALUES(?1,?2,?3,?4)",
            params![n.id, n.title, n.body, tag_text],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
