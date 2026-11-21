use std::{fs, path::Path};

use rusqlite::{params, Connection, Result};

use crate::models::Tag;

pub mod schema;

pub fn init(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;",
    )?;
    conn.execute_batch(schema::SCHEMA)?;
    seed(&conn)?;
    Ok(conn)
}

fn seed(conn: &Connection) -> Result<()> {
    let defaults = [
        ("theme", "midnight"),
        ("appearance", "dark"),
        ("accent", ""),
        ("password_hash", ""),
    ];
    for (key, value) in defaults {
        conn.execute(
            "INSERT OR IGNORE INTO settings(key, value) VALUES(?1, ?2)",
            params![key, value],
        )?;
    }
    Ok(())
}

pub fn note_from_row(row: &rusqlite::Row<'_>) -> Result<crate::models::Note> {
    Ok(crate::models::Note {
        id: row.get("id")?,
        title: row.get("title")?,
        body: row.get("body")?,
        folder_id: row.get("folder_id")?,
        pinned: row.get::<_, i64>("pinned")? != 0,
        archived: row.get::<_, i64>("archived")? != 0,
        trashed: row.get::<_, i64>("trashed")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        tags: Vec::new(),
    })
}

pub fn fetch_tags(conn: &Connection, note_id: &str) -> Result<Vec<Tag>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name FROM tags t
         JOIN note_tags nt ON nt.tag_id = t.id
         WHERE nt.note_id = ?1 ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![note_id], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    })?;
    rows.collect()
}

pub fn fts_insert(conn: &Connection, note: &crate::models::Note) -> Result<()> {
    let tags = if note.tags.is_empty() {
        fetch_tags(conn, &note.id)?
    } else {
        note.tags.clone()
    };
    let tag_text = tags
        .iter()
        .map(|t| t.name.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    // FTS5 has no UNIQUE constraint on UNINDEXED columns, so INSERT OR REPLACE
    // would append a duplicate row on every edit. Delete first to keep one row per note.
    conn.execute("DELETE FROM notes_fts WHERE id = ?1", params![note.id])?;
    conn.execute(
        "INSERT INTO notes_fts(id, title, body, tags) VALUES(?1, ?2, ?3, ?4)",
        params![note.id, note.title, note.body, tag_text],
    )?;
    Ok(())
}

pub fn fts_delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM notes_fts WHERE id = ?1", params![id])?;
    Ok(())
}

/// Rebuild one note's search row from current DB state (e.g. after a tag change).
pub fn reindex_note(conn: &Connection, id: &str) -> Result<()> {
    let mut stmt = conn.prepare("SELECT * FROM notes WHERE id=?1")?;
    let note = stmt.query_row(params![id], note_from_row)?;
    drop(stmt);
    fts_insert(conn, &note)
}

/// Escape a user query into safe FTS5 prefix tokens.
pub fn fts_query(input: &str) -> String {
    input
        .split_whitespace()
        .filter(|word| !word.is_empty())
        .map(|word| format!("\"{}\"*", word.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_safe_fts_query() {
        assert_eq!(fts_query("hello world"), "\"hello\"* AND \"world\"*");
        assert_eq!(fts_query("  "), "");
        assert_eq!(fts_query("a\"b"), "\"ab\"*");
    }

    #[test]
    fn creates_schema_in_memory() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(schema::SCHEMA).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table'", [], |r| r.get(0))
            .unwrap();
        assert!(count >= 7);
    }

    #[test]
    fn fts_insert_does_not_duplicate_on_update() {
        use crate::models::Note;
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(schema::SCHEMA).unwrap();
        let note = Note {
            id: "n1".into(),
            title: "First".into(),
            body: "alpha body".into(),
            folder_id: None,
            pinned: false,
            archived: false,
            trashed: false,
            created_at: "now".into(),
            updated_at: "now".into(),
            tags: vec![],
        };
        fts_insert(&conn, &note).unwrap();
        fts_insert(&conn, &note).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes_fts WHERE id='n1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
