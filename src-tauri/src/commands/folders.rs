use std::collections::HashSet;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;
use uuid::Uuid;

use crate::{models::Folder, AppState};

fn ensure_parent_is_valid(conn: &Connection, id: &str, parent_id: Option<&str>) -> Result<(), String> {
    let Some(parent_id) = parent_id else {
        return Ok(());
    };
    if parent_id == id {
        return Err("A folder cannot be its own parent".to_string());
    }
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM folders WHERE id=?1)",
            params![parent_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("Parent folder no longer exists".to_string());
    }

    let mut current = Some(parent_id.to_string());
    let mut seen = HashSet::new();
    while let Some(folder_id) = current {
        if !seen.insert(folder_id.clone()) || folder_id == id {
            return Err("A folder cannot be moved inside itself".to_string());
        }
        current = conn
            .query_row(
                "SELECT parent_id FROM folders WHERE id=?1",
                params![folder_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    state.ensure_unlocked()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders ORDER BY sort_order, name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Folder {
                id: row.get("id")?,
                name: row.get("name")?,
                parent_id: row.get("parent_id")?,
                color: row.get("color")?,
                sort_order: row.get("sort_order")?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut folders = Vec::new();
    for row in rows {
        folders.push(row.map_err(|e| e.to_string())?);
    }
    Ok(folders)
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_folder(
    name: String,
    parent_id: Option<String>,
    color: String,
    state: State<'_, AppState>,
) -> Result<Folder, String> {
    state.ensure_unlocked()?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ensure_parent_is_valid(&conn, "", parent_id.as_deref())?;
    let folder = Folder {
        id: Uuid::new_v4().to_string(),
        name,
        parent_id,
        color,
        sort_order: 0,
    };
    conn.execute(
        "INSERT INTO folders(id,name,parent_id,color,sort_order) VALUES(?1,?2,?3,?4,?5)",
        params![folder.id, folder.name, folder.parent_id, folder.color, folder.sort_order],
    )
    .map_err(|e| e.to_string())?;
    Ok(folder)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_folder(
    id: String,
    name: String,
    parent_id: Option<String>,
    color: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ensure_unlocked()?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    ensure_parent_is_valid(&conn, &id, parent_id.as_deref())?;
    let changed = conn
        .execute(
            "UPDATE folders SET name=?1, parent_id=?2, color=?3 WHERE id=?4",
            params![name, parent_id, color, id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Folder no longer exists".to_string());
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_folder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.ensure_unlocked()?;
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("UPDATE notes SET folder_id=NULL WHERE folder_id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE folders SET parent_id=NULL WHERE parent_id=?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM folders WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
