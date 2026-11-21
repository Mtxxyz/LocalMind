pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'Untitled',
    body        TEXT NOT NULL DEFAULT '',
    folder_id   TEXT,
    pinned      INTEGER NOT NULL DEFAULT 0,
    archived    INTEGER NOT NULL DEFAULT 0,
    trashed     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    parent_id   TEXT,
    color       TEXT NOT NULL DEFAULT '#7c8cff',
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id  TEXT NOT NULL,
    tag_id   TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id          TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL,
    filename    TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
    size        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
    id          TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL,
    due_at      TEXT NOT NULL,
    fired       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    body,
    tags,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id);
"#;
