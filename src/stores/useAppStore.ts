import { create } from 'zustand'
import { api } from '../lib/api'
import { applyPalette, applyVisualSettings, getTheme } from '../themes'
import type {
  Appearance,
  Attachment,
  Folder,
  Note,
  Reminder,
  Setting,
  ViewFilter,
} from '../types'

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function effectiveAppearance(appearance: Appearance): 'light' | 'dark' {
  if (appearance === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return appearance
}

interface AppState {
  notes: Note[]
  folders: Folder[]
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
  glassiness: number
  uiZoom: number
  settingsOpen: boolean
  settingsTab: 'appearance' | 'interface' | 'security' | 'data' | 'about'
  commandOpen: boolean
  folderMenuOpen: boolean
  folderMenuNoteId: string | null
  loading: boolean

  loadAll: () => Promise<void>
  resetAfterImport: () => Promise<void>
  refreshNotes: () => Promise<void>
  refreshReminders: () => Promise<void>
  refreshAttachments: (noteId: string) => Promise<void>
  selectNote: (id: string | null) => Promise<void>
  setFilter: (filter: ViewFilter) => Promise<void>
  setSearch: (value: string) => void
  createNote: () => Promise<string>
  updateNote: (id: string, title: string, body: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleArchive: (id: string) => Promise<void>
  archiveNote: (id: string, archived: boolean) => Promise<void>
  trashNote: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  moveNote: (id: string, folderId: string | null) => Promise<void>
  createFolder: (name: string, color: string, parentId?: string | null) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
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
  setGlassiness: (value: number) => Promise<void>
  setUiZoom: (value: number) => Promise<void>
  setSettingsOpen: (value: boolean) => void
  setSettingsTab: (value: 'appearance' | 'interface' | 'security' | 'data' | 'about') => void
  setCommandOpen: (value: boolean) => void
  openFolderMenu: (noteId?: string | null) => void
  closeFolderMenu: () => void
  registerPendingSave: (save: (() => Promise<void>) | null) => void
  flushPendingSave: () => Promise<void>
  setUnlocked: (value: boolean) => void
}

let pendingSave: (() => Promise<void>) | null = null
let flushPromise: Promise<void> | null = null

export const useAppStore = create<AppState>((set, get) => ({
  notes: [],
  folders: [],
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
  glassiness: 55,
  uiZoom: 100,
  settingsOpen: false,
  settingsTab: 'appearance',
  commandOpen: false,
  folderMenuOpen: false,
  folderMenuNoteId: null,
  loading: true,

  loadAll: async () => {
    try {
      const [notes, folders, reminders, settings] = await Promise.all([
        api.listNotes(),
        api.listFolders(),
        api.listReminders(),
        api.getSettings(),
      ])
      const map = new Map(settings.map((s: Setting) => [s.key, s.value]))
      const themeId = map.get('theme') || 'midnight'
      const appearance = (map.get('appearance') || 'dark') as Appearance
      const accent = map.get('accent') || ''
      const glassiness = clampNumber(map.get('glass'), 55, 0, 100)
      const uiZoom = clampNumber(map.get('zoom'), 100, 80, 140)
      set({
        notes,
        folders,
        reminders,
        themeId,
        appearance,
        accent,
        glassiness,
        uiZoom,
        loading: false,
      })
      const template = getTheme(themeId)
      const mode = effectiveAppearance(appearance)
      applyPalette(template[mode], accent, mode)
      applyVisualSettings(glassiness, uiZoom)
    } catch (error) {
      console.error('Failed to load LocalMind data', error)
      set({ loading: false })
    }
  },

  resetAfterImport: async () => {
    set({
      selectedId: null,
      filter: { kind: 'all' },
      search: '',
      attachments: [],
      editMode: false,
      focusMode: false,
      folderMenuOpen: false,
      folderMenuNoteId: null,
    })
    await get().loadAll()
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
    if (get().selectedId !== noteId) return
    set({ attachments })
  },

  selectNote: async (id) => {
    await get().flushPendingSave()
    set({ selectedId: id, editMode: false })
    if (id) void get().refreshAttachments(id)
    else set({ attachments: [] })
  },

  setFilter: async (filter) => {
    await get().flushPendingSave()
    set({ filter, search: '', selectedId: null, attachments: [] })
  },
  setSearch: (value) => set({ search: value }),

  createNote: async () => {
    await get().flushPendingSave()
    const state = get()
    const folderId = state.filter.kind === 'folder' ? state.filter.id : null
    const note = await api.createNote('Untitled note', '', folderId)
    await state.refreshNotes()
    set({
      selectedId: note.id,
      editMode: true,
      search: '',
      filter: state.filter.kind === 'folder' ? state.filter : { kind: 'all' },
    })
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
    await get().archiveNote(id, !note.archived)
  },

  archiveNote: async (id, archived) => {
    await get().flushPendingSave()
    if (archived) await api.setNoteTrashed(id, false)
    await api.setNoteArchived(id, archived)
    await get().refreshNotes()
    if (archived && get().selectedId === id) set({ selectedId: null })
  },

  trashNote: async (id) => {
    await get().flushPendingSave()
    await api.setNoteTrashed(id, true)
    await get().refreshNotes()
    set({ selectedId: null })
  },

  restoreNote: async (id) => {
    await api.setNoteTrashed(id, false)
    await get().refreshNotes()
  },

  emptyTrash: async () => {
    await get().flushPendingSave()
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

  renameFolder: async (id, name) => {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) return
    await api.updateFolder(id, name, folder.parent_id, folder.color)
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }))
  },

  deleteFolder: async (id) => {
    await get().flushPendingSave()
    await api.deleteFolder(id)
    const folders = await api.listFolders()
    const currentFilter = get().filter
    set((s) => ({
      folders,
      filter: currentFilter.kind === 'folder' && !folders.some((f) => f.id === currentFilter.id)
        ? { kind: 'all' }
        : s.filter,
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
    if (get().unlocked) await get().refreshReminders()
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

  setGlassiness: async (value) => {
    const next = Math.min(100, Math.max(0, Math.round(value)))
    set({ glassiness: next })
    applyVisualSettings(next, get().uiZoom)
    await api.setSetting('glass', String(next))
  },

  setUiZoom: async (value) => {
    const next = Math.min(140, Math.max(80, Math.round(value)))
    set({ uiZoom: next })
    applyVisualSettings(get().glassiness, next)
    await api.setSetting('zoom', String(next))
  },

  setSettingsOpen: (value) => set({ settingsOpen: value }),
  setSettingsTab: (value) => set({ settingsTab: value }),
  setCommandOpen: (value) => set({ commandOpen: value }),
  openFolderMenu: (noteId) => set({
    folderMenuOpen: true,
    // Browsing is the default. Only an explicit note id opens move mode.
    folderMenuNoteId: noteId ?? null,
  }),
  closeFolderMenu: () => set({ folderMenuOpen: false, folderMenuNoteId: null }),
  registerPendingSave: (save) => { pendingSave = save },
  flushPendingSave: async () => {
    // Keep the callback registered: EditorPane registers a stable function, so
    // clearing it here would silently disable all later flush-on-close/lock.
    if (flushPromise) return flushPromise
    const save = pendingSave
    if (!save) return
    flushPromise = Promise.resolve()
      .then(() => save())
      .finally(() => { flushPromise = null })
    return flushPromise
  },
  setUnlocked: (value) => set({ unlocked: value }),
}))
