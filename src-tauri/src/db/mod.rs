use std::{fs, path::Path};

use rusqlite::{params, Connection, Result};

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
    migrate(&conn)?;
    seed(&conn)?;
    Ok(conn)
}

/// Remove remnants of the removed tag feature and rebuild old FTS tables that
/// still indexed tag names. Existing v1.2.1 databases must keep working.
fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch("DROP TABLE IF EXISTS note_tags; DROP TABLE IF EXISTS tags;")?;

    // v1.2.1 stored absolute attachment paths. Normalize them to file names so
    // they keep working if the data folder is moved to another machine/path.
    let legacy_paths: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT id, stored_path FROM attachments")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.filter_map(Result::ok).collect()
    };
    for (id, stored) in legacy_paths {
        if !Path::new(&stored).is_absolute() {
            continue;
        }
        if let Some(name) = Path::new(&stored).file_name() {
            conn.execute(
                "UPDATE attachments SET stored_path=?1 WHERE id=?2",
                params![name.to_string_lossy().to_string(), id],
            )?;
        }
    }

    let fts_sql: String = conn
        .query_row(
            "SELECT COALESCE(sql, '') FROM sqlite_master WHERE name='notes_fts'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    if fts_sql.contains("tags") {
        conn.execute_batch(
            "DROP TABLE IF EXISTS notes_fts;
             CREATE VIRTUAL TABLE notes_fts USING fts5(
                 id UNINDEXED,
                 title,
                 body,
                 tokenize = 'unicode61 remove_diacritics 2'
             );
             INSERT INTO notes_fts(id, title, body) SELECT id, title, body FROM notes;",
        )?;
    }
    Ok(())
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
    })
}

pub fn fts_insert(conn: &Connection, note: &crate::models::Note) -> Result<()> {
    // FTS5 has no UNIQUE constraint on UNINDEXED columns, so INSERT OR REPLACE
    // would append a duplicate row on every edit. Delete first to keep one row per note.
    conn.execute("DELETE FROM notes_fts WHERE id = ?1", params![note.id])?;
    conn.execute(
        "INSERT INTO notes_fts(id, title, body) VALUES(?1, ?2, ?3)",
        params![note.id, note.title, note.body],
    )?;
    Ok(())
}

pub fn fts_delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM notes_fts WHERE id = ?1", params![id])?;
    Ok(())
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
        };
        fts_insert(&conn, &note).unwrap();
        fts_insert(&conn, &note).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes_fts WHERE id='n1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
