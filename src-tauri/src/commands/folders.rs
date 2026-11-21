use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::{models::Folder, AppState};

#[tauri::command(rename_all = "snake_case")]
pub fn list_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
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
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
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
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE folders SET name=?1, parent_id=?2, color=?3 WHERE id=?4",
        params![name, parent_id, color, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_folder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET folder_id=NULL WHERE folder_id=?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE folders SET parent_id=NULL WHERE parent_id=?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM folders WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
