import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BellRing,
  FileText,
  Folder as FolderIcon,
  Inbox,
  Lock,
  LogOut,
  Pin,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import type { Note } from '../../types'
import { EmptyState, IconButton } from '../ui'

const titles: Record<string, string> = {
  all: 'All notes',
  archive: 'Archive',
  trash: 'Deleted',
  reminders: 'Reminders',
}

export function Sidebar() {
  const {
    notes,
    folders,
    reminders,
    filter,
    search,
    setSearch,
    selectedId,
    selectNote,
    setFilter,
    createNote,
    emptyTrash,
    setSettingsOpen,
    setUnlocked,
    flushPendingSave,
    openFolderMenu,
    folderMenuOpen,
  } = useAppStore()

  const [searchResults, setSearchResults] = useState<Note[] | null>(null)

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null)
      return
    }
    const timer = window.setTimeout(() => {
      void api.searchNotes(search).then(setSearchResults).catch(() => setSearchResults([]))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [search, notes])

  useEffect(() => {
    setSearchResults(null)
  }, [filter])

  const visible = useMemo(() => {
    let list = searchResults ?? notes
    if (filter.kind === 'folder') list = list.filter((n) => n.folder_id === filter.id)
    if (filter.kind === 'archive') list = list.filter((n) => n.archived && !n.trashed)
    if (filter.kind === 'trash') list = list.filter((n) => n.trashed)
    if (filter.kind === 'reminders') {
      const ids = new Set(reminders.filter((r) => !r.fired).map((r) => r.note_id))
      list = list.filter((n) => ids.has(n.id) && !n.trashed)
    }
    if (filter.kind !== 'trash') list = list.filter((n) => !n.trashed)
    return list
  }, [notes, searchResults, filter, reminders])

  const title =
    filter.kind === 'folder'
      ? folders.find((f) => f.id === filter.id)?.name ?? 'Folder'
      : titles[filter.kind] ?? 'Notes'

  const reminderNoteIds = useMemo(
    () => new Set(reminders.filter((r) => !r.fired).map((r) => r.note_id)),
    [reminders],
  )

  return (
    <aside className="glass-panel relative flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--border)]">
      <div className="flex h-[56px] items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--accent-fg)]">
          <ShieldCheck size={18} strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold tracking-tight">LocalMind</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">Private by design</div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => void createNote()}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[13px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <Plus size={16} strokeWidth={2.4} />
          New note
          <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-medium">Ctrl+Shift+N</span>
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input
            id="note-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="h-9 w-full rounded-lg border border-transparent bg-[var(--surface-2)] pl-9 pr-8 text-[13px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--faint)] hover:text-[var(--text)]"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => setFilter({ kind: 'all' })}
          className={cn(
            'flex h-9 flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors',
            filter.kind === 'all'
              ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
          )}
        >
          <FileText size={15} />
          All notes
        </button>
        <button
          onClick={() => openFolderMenu()}
          aria-label="Open folders, archive, deleted and add folders"
          title="Open folders, archive, deleted and add folders"
          className={cn(
            'flex h-9 flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors',
            folderMenuOpen
              ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
          )}
        >
          <FolderIcon size={15} />
          Folders
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">{title}</span>
          <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--faint)]">
            {visible.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={filter.kind === 'trash' ? <Trash2 size={22} /> : filter.kind === 'archive' ? <Archive size={22} /> : search ? <Search size={22} /> : <Inbox size={22} />}
            title={search ? 'No matches' : filter.kind === 'trash' ? 'Trash is empty' : 'Nothing here yet'}
            description={search ? 'Try a different word.' : 'Create a note to get started.'}
          />
        ) : (
          <div className="space-y-1">
            {visible.map((note) => {
              const folder = folders.find((f) => f.id === note.folder_id)
              const snippet = note.body.replace(/[#*`>[\]()!]/g, '').replace(/\s+/g, ' ').trim()
              return (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onClick={() => selectNote(note.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectNote(note.id)
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', note.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  className={cn(
                    'group relative w-full cursor-grab rounded-xl border px-3 py-2.5 text-left transition-colors active:cursor-grabbing',
                    selectedId === note.id
                      ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-transparent hover:bg-[var(--surface-2)]',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {note.pinned && <Pin size={11} className="shrink-0 text-[var(--accent)]" />}
                        {reminderNoteIds.has(note.id) && (
                          <BellRing size={11} className="shrink-0 text-[var(--accent)]" />
                        )}
                        <span className="truncate text-[13px] font-semibold text-[var(--text)]">
                          {note.title || 'Untitled note'}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                        {snippet || 'Empty note'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[10px] tabular-nums text-[var(--faint)]">{formatDate(note.updated_at)}</span>
                      <div className="flex items-center gap-1.5">
                        {folder && (
                          <span className="h-2 w-2 rounded-full" style={{ background: folder.color }} title={folder.name} />
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            openFolderMenu(note.id)
                          }}
                          title="Open folders for this note"
                          aria-label="Open folders for this note"
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                        >
                          <FolderIcon size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        {filter.kind === 'trash' && visible.length > 0 && (
          <button
            onClick={() => void emptyTrash()}
            className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          >
            <Trash2 size={12} /> Empty trash
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <Settings2 size={16} />
            Settings
          </button>
          <IconButton
            label="Lock app (requires password to reopen)"
            className="h-9 w-9"
            onClick={() => void (async () => {
              await flushPendingSave()
              await api.setAppLocked(true)
              setUnlocked(false)
            })()}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-2.5 text-[10px] text-[var(--faint)]">
          <Lock size={11} />
          100% offline · no telemetry
        </div>
      </div>
    </aside>
  )
}
