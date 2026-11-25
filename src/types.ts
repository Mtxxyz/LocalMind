export interface Note {
  id: string
  title: string
  body: string
  folder_id: string | null
  pinned: boolean
  archived: boolean
  trashed: boolean
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  color: string
  sort_order: number
}

export interface Attachment {
  id: string
  note_id: string
  filename: string
  stored_path: string
  mime: string
  size: number
  created_at: string
}

export interface Reminder {
  id: string
  note_id: string
  note_title: string
  due_at: string
  fired: boolean
  created_at: string
}

export interface Setting {
  key: string
  value: string
}

export type ViewFilter =
  | { kind: 'all' }
  | { kind: 'folder'; id: string }
  | { kind: 'archive' }
  | { kind: 'trash' }
  | { kind: 'reminders' }

export type NoteSort = 'newest' | 'oldest' | 'created' | 'name'

export type Appearance = 'light' | 'dark' | 'system'
