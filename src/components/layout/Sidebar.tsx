import { useState, type ReactNode } from 'react'
import {
  Archive,
  BellRing,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  Hash,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import type { Folder, ViewFilter } from '../../types'
import { IconButton } from '../ui'

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

export function Sidebar() {
  const {
    notes,
    folders,
    tags,
    reminders,
    filter,
    setFilter,
    createNote,
    createFolder,
    deleteFolder,
    deleteTag,
    setSettingsOpen,
  } = useAppStore()

  const [adding, setAdding] = useState<'folder' | 'tag' | null>(null)
  const [draft, setDraft] = useState('')
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [subfolderFor, setSubfolderFor] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState('')

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
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <div className="flex h-[60px] items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--accent-fg)]">
          <ShieldCheck size={18} strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold tracking-tight">LocalMind</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">Private by design</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => void createNote()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[13px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <Plus size={16} strokeWidth={2.4} />
          New note
          <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-medium">Ctrl+Shift+N</span>
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          <NavItem
            icon={<FileText size={16} />}
            label="All notes"
            active={isActive('all')}
            count={notes.filter((n) => !n.trashed && !n.archived).length}
            onClick={() => setFilter({ kind: 'all' })}
          />
          <NavItem
            icon={<BellRing size={16} />}
            label="Reminders"
            active={isActive('reminders')}
            count={reminders.length}
            onClick={() => setFilter({ kind: 'reminders' })}
          />
          <NavItem
            icon={<Archive size={16} />}
            label="Archive"
            active={isActive('archive')}
            count={notes.filter((n) => n.archived && !n.trashed).length}
            onClick={() => setFilter({ kind: 'archive' })}
          />
          <NavItem
            icon={<Trash2 size={16} />}
            label="Trash"
            active={isActive('trash')}
            count={notes.filter((n) => n.trashed).length}
            onClick={() => setFilter({ kind: 'trash' })}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2">
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
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2">
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
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <button
          onClick={() => {
            const id = filter.kind === 'folder' ? filter.id : null
            if (id) void deleteFolder(id)
          }}
          className={cn(
            'mb-1 hidden h-8 w-full items-center gap-2 rounded-lg px-2.5 text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]',
            filter.kind === 'folder' && 'flex',
          )}
        >
          <Trash2 size={13} /> Delete this folder
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <Settings2 size={16} />
          Settings
        </button>
        <div className="mt-2 flex items-center gap-1.5 px-2.5 text-[10px] text-[var(--faint)]">
          <FolderIcon size={11} />
          100% offline · no telemetry
        </div>
      </div>
    </aside>
  )
}
