import { invoke } from '@tauri-apps/api/core'
import type {
  Attachment,
  Folder,
  Note,
  Reminder,
  Setting,
} from '../types'

export const api = {
  listNotes: () => invoke<Note[]>('list_notes'),
  getNote: (id: string) => invoke<Note | null>('get_note', { id }),
  createNote: (title: string, body: string, folder_id: string | null = null) =>
    invoke<Note>('create_note', { title, body, folder_id }),
  updateNote: (id: string, title: string, body: string) =>
    invoke<Note>('update_note', { id, title, body }),
  moveNoteToFolder: (id: string, folder_id: string | null) =>
    invoke<void>('move_note_to_folder', { id, folder_id }),
  setNotePinned: (id: string, value: boolean) =>
    invoke<void>('set_note_pinned', { id, value }),
  setNoteArchived: (id: string, value: boolean) =>
    invoke<void>('set_note_archived', { id, value }),
  setNoteTrashed: (id: string, value: boolean) =>
    invoke<void>('set_note_trashed', { id, value }),
  emptyTrash: () => invoke<void>('empty_trash'),
  searchNotes: (query: string) => invoke<Note[]>('search_notes', { query }),

  listFolders: () => invoke<Folder[]>('list_folders'),
  createFolder: (name: string, parent_id: string | null, color: string) =>
    invoke<Folder>('create_folder', { name, parent_id, color }),
  updateFolder: (id: string, name: string, parent_id: string | null, color: string) =>
    invoke<void>('update_folder', { id, name, parent_id, color }),
  deleteFolder: (id: string) => invoke<void>('delete_folder', { id }),

  listAttachments: (note_id: string) =>
    invoke<Attachment[]>('list_attachments', { note_id }),
  attachFile: (note_id: string, source_path: string) =>
    invoke<Attachment>('attach_file', { note_id, source_path }),
  detachAttachment: (id: string) => invoke<void>('detach_attachment', { id }),

  listReminders: () => invoke<Reminder[]>('list_reminders'),
  createReminder: (note_id: string, due_at: string) =>
    invoke<Reminder>('create_reminder', { note_id, due_at }),
  deleteReminder: (id: string) => invoke<void>('delete_reminder', { id }),
  markReminderFired: (id: string) => invoke<void>('mark_reminder_fired', { id }),

  listFonts: () => invoke<string[]>('list_fonts'),
  getSettings: () => invoke<Setting[]>('get_settings'),
  setSetting: (key: string, value: string) =>
    invoke<void>('set_setting', { key, value }),
  hasPassword: () => invoke<boolean>('has_password'),
  setPassword: (password: string) => invoke<void>('set_password', { password }),
  verifyPassword: (password: string) =>
    invoke<boolean>('verify_password', { password }),
  removePassword: () => invoke<void>('remove_password'),
  getDataPath: () => invoke<string>('get_data_path'),
  setAppLocked: (locked: boolean) => invoke<void>('set_app_locked', { locked }),

  exportMarkdown: (note_ids: string[], target_path: string) =>
    invoke<void>('export_markdown', { note_ids, target_path }),
  exportFolder: (folder_id: string, target_path: string) =>
    invoke<void>('export_folder', { folder_id, target_path }),
  exportBackup: (target_path: string) =>
    invoke<void>('export_backup', { target_path }),
  importBackup: (source_path: string) =>
    invoke<void>('import_backup', { source_path }),
}
