import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import {
  Archive,
  BellRing,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder as FolderIcon,
  Github,
  Hash,
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
import type { Folder, Note, ViewFilter } from '../../types'
import { EmptyState, IconButton } from '../ui'

const folderColors = ['#7c8cff', '#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#fb7185']

function NavItem({
  icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  count?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
        active
          ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
          : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] tabular-nums text-[var(--faint)]">{count}</span>
      )}
    </button>
  )
}

interface FolderTreeProps {
  folders: Folder[]
  parentId: string | null
  depth: number
  activeId: string | null
  onSelect: (id: string) => void
  onAddSub: (id: string) => void
  subfolderFor: string | null
  subDraft: string
  onSubDraft: (value: string) => void
  onSubmitSub: (parentId: string) => void
  onCancelSub: () => void
}

function FolderTree({
  folders,
  parentId,
  depth,
  activeId,
  onSelect,
  onAddSub,
  subfolderFor,
  subDraft,
  onSubDraft,
  onSubmitSub,
  onCancelSub,
}: FolderTreeProps) {
  const children = folders.filter((f) => f.parent_id === parentId)
  if (children.length === 0) return null
  return (
    <div>
      {children.map((folder) => (
        <div key={folder.id}>
          <div className="group flex items-center">
            <button
              onClick={() => onSelect(folder.id)}
              style={{ paddingLeft: 10 + depth * 12 }}
              className={cn(
                'flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg pr-1 text-[13px] transition-colors',
                activeId === folder.id
                  ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: folder.color }} />
              <span className="flex-1 truncate text-left">{folder.name}</span>
            </button>
            <IconButton
              label="New subfolder"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => onAddSub(folder.id)}
            >
              <Plus size={12} />
            </IconButton>
          </div>
          {subfolderFor === folder.id && (
            <div style={{ paddingLeft: 18 + depth * 12 }} className="py-1 pr-2">
              <input
                autoFocus
                value={subDraft}
                onChange={(e) => onSubDraft(e.target.value)}
                onBlur={() => onSubmitSub(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmitSub(folder.id)
                  if (e.key === 'Escape') onCancelSub()
                }}
                placeholder="Subfolder name"
                className="h-7 w-full rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-2 text-[12px] outline-none"
              />
            </div>
          )}
          <FolderTree
            folders={folders}
            parentId={folder.id}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
            onAddSub={onAddSub}
            subfolderFor={subfolderFor}
            subDraft={subDraft}
            onSubDraft={onSubDraft}
            onSubmitSub={onSubmitSub}
            onCancelSub={onCancelSub}
          />
        </div>
      ))}
    </div>
  )
}

const titles: Record<string, string> = {
  all: 'All notes',
  archive: 'Archive',
  trash: 'Trash',
  reminders: 'Reminders',
}

export function Sidebar() {
  const {
    notes,
    folders,
    tags,
    reminders,
    filter,
    search,
    setSearch,
    selectedId,
    selectNote,
    setFilter,
    createNote,
    createFolder,
    deleteFolder,
    deleteTag,
    setSettingsOpen,
    setSettingsTab,
    setUnlocked,
    emptyTrash,
  } = useAppStore()

  const [adding, setAdding] = useState<'folder' | 'tag' | null>(null)
  const [draft, setDraft] = useState('')
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [subfolderFor, setSubfolderFor] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState('')
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

  const isActive = (kind: ViewFilter['kind'], id?: string) =>
    filter.kind === kind && (id === undefined || ('id' in filter && filter.id === id))

  const submit = async () => {
    const value = draft.trim()
    if (!value) {
      setAdding(null)
      return
    }
    if (adding === 'folder') {
      const color = folderColors[folders.length % folderColors.length]
      await createFolder(value, color)
    } else if (adding === 'tag') {
      const tag = await api.createTag(value)
      useAppStore.setState((s) => ({ tags: [...s.tags, tag] }))
    }
    setDraft('')
    setAdding(null)
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
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
        {[
          { kind: 'all' as const, label: 'All notes', icon: <FileText size={15} /> },
          { kind: 'reminders' as const, label: 'Reminders', icon: <BellRing size={15} /> },
          { kind: 'archive' as const, label: 'Archive', icon: <Archive size={15} /> },
          { kind: 'trash' as const, label: 'Trash', icon: <Trash2 size={15} /> },
        ].map((item) => (
          <button
            key={item.kind}
            title={item.label}
            aria-label={item.label}
            onClick={() => setFilter({ kind: item.kind })}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              isActive(item.kind)
                ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
            )}
          >
            {item.icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="mb-1 flex items-center justify-between">
          <button
            onClick={() => setFoldersOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)] hover:text-[var(--muted)]"
          >
            {foldersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Folders
          </button>
          <IconButton label="New folder" className="h-6 w-6" onClick={() => { setAdding('folder'); setDraft('') }}>
            <Plus size={13} />
          </IconButton>
        </div>
        {foldersOpen && (
          <div className="space-y-0.5">
            <FolderTree
              folders={folders}
              parentId={null}
              depth={0}
              activeId={filter.kind === 'folder' ? filter.id : null}
              onSelect={(id) => setFilter({ kind: 'folder', id })}
              onAddSub={(id) => { setSubfolderFor(id); setSubDraft('') }}
              subfolderFor={subfolderFor}
              subDraft={subDraft}
              onSubDraft={setSubDraft}
              onSubmitSub={(parentId) => {
                const value = subDraft.trim()
                if (value) {
                  const color = folderColors[folders.length % folderColors.length]
                  void createFolder(value, color, parentId)
                }
                setSubDraft('')
                setSubfolderFor(null)
              }}
              onCancelSub={() => { setSubfolderFor(null); setSubDraft('') }}
            />
            {adding === 'folder' && (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void submit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                  if (e.key === 'Escape') { setAdding(null); setDraft('') }
                }}
                placeholder="Folder name"
                className="h-8 w-full rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-2.5 text-[13px] outline-none"
              />
            )}
          </div>
        )}

        <div className="mb-1 mt-3 flex items-center justify-between">
          <button
            onClick={() => setTagsOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)] hover:text-[var(--muted)]"
          >
            {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Tags
          </button>
          <IconButton label="New tag" className="h-6 w-6" onClick={() => { setAdding('tag'); setDraft('') }}>
            <Plus size={13} />
          </IconButton>
        </div>
        {tagsOpen && (
          <div className="space-y-0.5">
            {tags.map((tag) => (
              <div key={tag.id} className="group flex items-center">
                <button
                  onClick={() => setFilter({ kind: 'tag', id: tag.id })}
                  className={cn(
                    'flex h-8 flex-1 items-center gap-2.5 rounded-lg pl-3 pr-2 text-[13px] transition-colors',
                    isActive('tag', tag.id)
                      ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                  )}
                >
                  <Hash size={14} className="shrink-0" />
                  <span className="flex-1 truncate text-left">{tag.name}</span>
                </button>
                <IconButton
                  label={`Delete tag ${tag.name}`}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => void deleteTag(tag.id)}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))}
            {adding === 'tag' && (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void submit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                  if (e.key === 'Escape') { setAdding(null); setDraft('') }
                }}
                placeholder="Tag name"
                className="h-8 w-full rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-2.5 text-[13px] outline-none"
              />
            )}
          </div>
        )}

        <div className="mt-3 mb-1 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
            {title}
          </span>
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

      <div className="border-t border-[var(--border)] p-3">
        {filter.kind === 'folder' && (
          <button
            onClick={() => {
              const id = filter.kind === 'folder' ? filter.id : null
              if (id) void deleteFolder(id)
            }}
            className="mb-1 flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          >
            <Trash2 size={13} /> Delete this folder
          </button>
        )}
        {filter.kind === 'trash' && visible.length > 0 && (
          <button
            onClick={() => void emptyTrash()}
            className="mb-1 flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          >
            <Trash2 size={13} /> Empty trash
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
            onClick={() => {
              void api.setAppLocked(true)
              setUnlocked(false)
            }}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-2.5 text-[10px] text-[var(--faint)]">
          <FolderIcon size={11} />
          100% offline · no telemetry
        </div>
      </div>
    </aside>
  )
}