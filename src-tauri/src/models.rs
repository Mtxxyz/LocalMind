use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub folder_id: Option<String>,
    pub pinned: bool,
    pub archived: bool,
    pub trashed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteTag {
    pub note_id: String,
    pub tag_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub note_id: String,
    pub filename: String,
    pub stored_path: String,
    pub mime: String,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub note_id: String,
    pub note_title: String,
    pub due_at: String,
    pub fired: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Backup {
    pub notes: Vec<Note>,
    pub folders: Vec<Folder>,
    pub tags: Vec<Tag>,
    pub note_tags: Vec<NoteTag>,
    pub attachments: Vec<Attachment>,
    pub reminders: Vec<Reminder>,
    pub settings: Vec<Setting>,
}
