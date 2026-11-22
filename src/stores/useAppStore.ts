import { create } from 'zustand'
import { api } from '../lib/api'
import { applyPalette, getTheme } from '../themes'
import type {
  Appearance,
  Attachment,
  Folder,
  Note,
  Reminder,
  Setting,
  Tag,
  ViewFilter,
} from '../types'

function effectiveAppearance(appearance: Appearance): 'light' | 'dark' {
  if (appearance === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return appearance
}

interface AppState {
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  reminders: Reminder[]
  attachments: Attachment[]
  selectedId: string | null
  filter: ViewFilter
  search: string
  unlocked: boolean
  themeId: string
  appearance: Appearance
  accent: string
  editMode: boolean
  focusMode: boolean
  settingsOpen: boolean
  settingsTab: 'appearance' | 'security' | 'data' | 'about'
  commandOpen: boolean
  loading: boolean

  loadAll: () => Promise<void>
  refreshNotes: () => Promise<void>
  refreshReminders: () => Promise<void>
  refreshAttachments: (noteId: string) => Promise<void>
  selectNote: (id: string | null) => void
  setFilter: (filter: ViewFilter) => void
  setSearch: (value: string) => void
  createNote: () => Promise<string>
  updateNote: (id: string, title: string, body: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleArchive: (id: string) => Promise<void>
  trashNote: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  moveNote: (id: string, folderId: string | null) => Promise<void>
  createFolder: (name: string, color: string, parentId?: string | null) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  createTagForNote: (noteId: string, name: string) => Promise<void>
  toggleNoteTag: (noteId: string, tagId: string) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  addReminder: (noteId: string, dueAt: string) => Promise<void>
  deleteReminder: (id: string) => Promise<void>
  fireReminder: (id: string) => Promise<void>
  addAttachment: (noteId: string, path: string) => Promise<void>
  removeAttachment: (id: string, noteId: string) => Promise<void>
  setTheme: (id: string) => Promise<void>
  setAppearance: (value: Appearance) => Promise<void>
  setAccent: (value: string) => Promise<void>
  refreshTheme: () => void
  setEditMode: (value: boolean) => void
  setFocusMode: (value: boolean) => void
  setSettingsOpen: (value: boolean) => void
  setSettingsTab: (value: 'appearance' | 'security' | 'data' | 'about') => void
  setCommandOpen: (value: boolean) => void
  setUnlocked: (value: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  notes: [],
  folders: [],
  tags: [],
  reminders: [],
  attachments: [],
  selectedId: null,
  filter: { kind: 'all' },
  search: '',
  unlocked: false,
  themeId: 'midnight',
  appearance: 'dark',
  accent: '',
  editMode: false,
  focusMode: false,
  settingsOpen: false,
  settingsTab: 'appearance',
  commandOpen: false,
  loading: true,

  loadAll: async () => {
    try {
      const [notes, folders, tags, reminders, settings] = await Promise.all([
        api.listNotes(),
        api.listFolders(),
        api.listTags(),
        api.listReminders(),
        api.getSettings(),
      ])
      const map = new Map(settings.map((s: Setting) => [s.key, s.value]))
      const themeId = map.get('theme') || 'midnight'
      const appearance = (map.get('appearance') || 'dark') as Appearance
      const accent = map.get('accent') || ''
      set({
        notes,
        folders,
        tags,
        reminders,
        themeId,
        appearance,
        accent,
        loading: false,
      })
      const template = getTheme(themeId)
      const mode = effectiveAppearance(appearance)
      applyPalette(template[mode], accent, mode)
    } catch (error) {
      console.error('Failed to load LocalMind data', error)
      set({ loading: false })
    }
  },

  refreshNotes: async () => {
    const notes = await api.listNotes()
    set({ notes })
  },

  refreshReminders: async () => {
    const reminders = await api.listReminders()
    set({ reminders })
  },

  refreshAttachments: async (noteId: string) => {
    const attachments = await api.listAttachments(noteId)
    set({ attachments })
  },

  selectNote: (id) => {
    set({ selectedId: id, editMode: false })
    if (id) void get().refreshAttachments(id)
    else set({ attachments: [] })
  },

  setFilter: (filter) => set({ filter, selectedId: null, attachments: [] }),
  setSearch: (value) => set({ search: value }),

  createNote: async () => {
    const state = get()
    const folderId = state.filter.kind === 'folder' ? state.filter.id : null
    const note = await api.createNote('Untitled note', '', folderId)
    await state.refreshNotes()
    set({ selectedId: note.id, editMode: true, search: '' })
    void state.refreshAttachments(note.id)
    return note.id
  },

  updateNote: async (id, title, body) => {
    const updated = await api.updateNote(id, title, body)
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? updated : n)),
    }))
  },

  togglePin: async (id) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    await api.setNotePinned(id, !note.pinned)
    await get().refreshNotes()
  },

  toggleArchive: async (id) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    await api.setNoteArchived(id, !note.archived)
    await get().refreshNotes()
    set({ selectedId: null })
  },

  trashNote: async (id) => {
    await api.setNoteTrashed(id, true)
    await get().refreshNotes()
    set({ selectedId: null })
  },

  restoreNote: async (id) => {
    await api.setNoteTrashed(id, false)
    await get().refreshNotes()
  },

  emptyTrash: async () => {
    await api.emptyTrash()
    await get().refreshNotes()
    set({ selectedId: null })
  },

  moveNote: async (id, folderId) => {
    await api.moveNoteToFolder(id, folderId)
    await get().refreshNotes()
  },

  createFolder: async (name, color, parentId = null) => {
    const folder = await api.createFolder(name, parentId, color)
    set((s) => ({ folders: [...s.folders, folder] }))
  },

  deleteFolder: async (id) => {
    await api.deleteFolder(id)
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      filter: s.filter.kind === 'folder' && s.filter.id === id ? { kind: 'all' } : s.filter,
    }))
    await get().refreshNotes()
  },

  createTagForNote: async (noteId, name) => {
    const tag = await api.createTag(name)
    await api.addTagToNote(noteId, tag.id)
    const tags = await api.listTags()
    await get().refreshNotes()
    set({ tags })
  },

  toggleNoteTag: async (noteId, tagId) => {
    const note = get().notes.find((n) => n.id === noteId)
    if (!note) return
    const has = note.tags.some((t) => t.id === tagId)
    if (has) await api.removeTagFromNote(noteId, tagId)
    else await api.addTagToNote(noteId, tagId)
    await get().refreshNotes()
  },

  deleteTag: async (id) => {
    await api.deleteTag(id)
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      filter: s.filter.kind === 'tag' && s.filter.id === id ? { kind: 'all' } : s.filter,
    }))
    await get().refreshNotes()
  },

  addReminder: async (noteId, dueAt) => {
    await api.createReminder(noteId, dueAt)
    await get().refreshReminders()
  },

  deleteReminder: async (id) => {
    await api.deleteReminder(id)
    await get().refreshReminders()
  },

  fireReminder: async (id) => {
    await api.markReminderFired(id)
    await get().refreshReminders()
  },

  addAttachment: async (noteId, path) => {
    await api.attachFile(noteId, path)
    await get().refreshAttachments(noteId)
  },

  removeAttachment: async (id, noteId) => {
    await api.detachAttachment(id)
    await get().refreshAttachments(noteId)
  },

  setTheme: async (id) => {
    set({ themeId: id })
    await api.setSetting('theme', id)
    get().refreshTheme()
  },

  setAppearance: async (value) => {
    set({ appearance: value })
    await api.setSetting('appearance', value)
    get().refreshTheme()
  },

  setAccent: async (value) => {
    set({ accent: value })
    await api.setSetting('accent', value)
    get().refreshTheme()
  },

  refreshTheme: () => {
    const { themeId, appearance, accent } = get()
    const mode = effectiveAppearance(appearance)
    applyPalette(getTheme(themeId)[mode], accent, mode)
  },

  setEditMode: (value) => set({ editMode: value }),
  setFocusMode: (value) => set({ focusMode: value }),
  setSettingsOpen: (value) => set({ settingsOpen: value }),
  setSettingsTab: (value) => set({ settingsTab: value }),
  setCommandOpen: (value) => set({ commandOpen: value }),
  setUnlocked: (value) => set({ unlocked: value }),
}))
