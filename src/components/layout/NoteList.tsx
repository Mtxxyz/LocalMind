import { useEffect, useMemo, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { Archive, BellRing, Download, FileText, Inbox, Pin, Search, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import type { Note } from '../../types'
import { EmptyState, IconButton } from '../ui'

const titles: Record<string, string> = {
  all: 'All notes',
  archive: 'Archive',
  trash: 'Trash',
  reminders: 'Reminders',
}

export function NoteList() {
  const {
    notes,
    folders,
    filter,
    search,
    setSearch,
    selectedId,
    selectNote,
    reminders,
    emptyTrash,
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
  }, [search])

  const visible = useMemo(() => {
    let list = searchResults ?? notes
    if (filter.kind === 'folder') list = list.filter((n) => n.folder_id === filter.id)
    if (filter.kind === 'tag') list = list.filter((n) => n.tags.some((t) => t.id === filter.id))
    if (filter.kind === 'archive') list = list.filter((n) => n.archived && !n.trashed)
    if (filter.kind === 'trash') list = list.filter((n) => n.trashed)
    if (filter.kind === 'reminders') {
      const ids = new Set(reminders.map((r) => r.note_id))
      list = list.filter((n) => ids.has(n.id) && !n.trashed)
    }
    if (filter.kind !== 'trash') list = list.filter((n) => !n.trashed)
    return list
  }, [notes, searchResults, filter, reminders])

  const title =
    filter.kind === 'folder'
      ? folders.find((f) => f.id === filter.id)?.name ?? 'Folder'
      : filter.kind === 'tag'
        ? `#${useAppStore.getState().tags.find((t) => t.id === filter.id)?.name ?? 'Tag'}`
        : titles[filter.kind] ?? 'Notes'

  return (
    <section className="flex h-full w-[320px] shrink-0 flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)]">
      <div className="flex h-[60px] items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--faint)]">
            {visible.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {filter.kind === 'folder' && (
            <IconButton
              label="Export folder as Markdown"
              onClick={() => void (async () => {
                const target = await save({
                  filters: [{ name: 'Markdown', extensions: ['md'] }],
                  defaultPath: `${title || 'folder'}.md`,
                })
                if (target) await api.exportFolder(filter.id, target)
              })()}
            >
              <Download size={15} />
            </IconButton>
          )}
          {filter.kind === 'trash' && visible.length > 0 && (
            <IconButton label="Empty trash" onClick={() => void emptyTrash()}>
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
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

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {visible.length === 0 ? (
          <EmptyState
            icon={filter.kind === 'trash' ? <Trash2 size={26} /> : filter.kind === 'archive' ? <Archive size={26} /> : search ? <Search size={26} /> : <Inbox size={26} />}
            title={search ? 'No matches' : filter.kind === 'trash' ? 'Trash is empty' : 'Nothing here yet'}
            description={search ? 'Try a different word.' : 'Create a note to get started.'}
          />
        ) : (
          <div className="space-y-1">
            {visible.map((note) => {
              const folder = folders.find((f) => f.id === note.folder_id)
              const snippet = note.body.replace(/[#*`>\-[\]()!]/g, '').replace(/\s+/g, ' ').trim()
              return (
                <button
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                  className={cn(
                    'group relative w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                    selectedId === note.id
                      ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-transparent hover:bg-[var(--surface-2)]',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {note.pinned && <Pin size={11} className="shrink-0 text-[var(--accent)]" />}
                        {reminders.some((r) => r.note_id === note.id) && (
                          <BellRing size={11} className="shrink-0 text-[var(--accent)]" />
                        )}
                        <span className="truncate text-[13px] font-semibold text-[var(--text)]">
                          {note.title || 'Untitled note'}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                        {snippet || 'Empty note'}
                      </p>
                      {note.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag.id} className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--faint)]">
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[10px] tabular-nums text-[var(--faint)]">{formatDate(note.updated_at)}</span>
                      {folder && (
                        <span className="h-2 w-2 rounded-full" style={{ background: folder.color }} title={folder.name} />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-2.5 text-[10px] text-[var(--faint)]">
        <FileText size={11} className="mr-1 inline" />
        {notes.filter((n) => !n.trashed).length} notes stored locally
      </div>
    </section>
  )
}
