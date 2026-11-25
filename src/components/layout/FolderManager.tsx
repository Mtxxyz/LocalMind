import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { ask, save } from '@tauri-apps/plugin-dialog'
import {
  Archive,
  BellRing,
  Check,
  Download,
  FileText,
  Folder as FolderIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import type { Folder } from '../../types'
import { IconButton } from '../ui'

const folderColors = ['#7c8cff', '#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#fb7185']

function flattenFolders(
  folders: Folder[],
  parentId: string | null = null,
  depth = 0,
  visited = new Set<string>(),
): Array<{ folder: Folder; depth: number }> {
  const result: Array<{ folder: Folder; depth: number }> = []
  for (const folder of folders.filter((f) => f.parent_id === parentId)) {
    if (visited.has(folder.id)) continue
    visited.add(folder.id)
    result.push({ folder, depth })
    result.push(...flattenFolders(folders, folder.id, depth + 1, visited))
  }
  return result
}

interface DestinationProps {
  icon: ReactNode
  label: string
  count?: number
  active: boolean
  highlight?: boolean
  indent?: number
  color?: string
  trailing?: ReactNode
  onClick: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
}

function DestinationRow({
  icon,
  label,
  count,
  active,
  highlight,
  indent = 0,
  color,
  trailing,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: DestinationProps) {
  const activate = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={activate}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ paddingLeft: 8 + indent * 12 }}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-lg pr-2 text-[13px] outline-none transition-colors',
        active
          ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
          : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)]',
        highlight && 'outline outline-1 outline-[var(--accent)]',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      {count !== undefined && count > 0 && (
        <span className="text-[11px] tabular-nums text-[var(--faint)]">{count}</span>
      )}
      {trailing}
    </div>
  )
}

export function FolderManager() {
  const {
    notes,
    folders,
    reminders,
    filter,
    selectedId,
    focusMode,
    sidebarWidth,
    uiZoom,
    draggingNoteId,
    folderMenuOpen,
    folderMenuNoteId,
    closeFolderMenu,
    setFilter,
    createFolder,
    renameFolder,
    deleteFolder,
    moveNote,
    archiveNote,
    trashNote,
    emptyTrash,
    refreshNotes,
  } = useAppStore()

  const [folderFormParent, setFolderFormParent] = useState<string | null | undefined>(undefined)
  const [folderDraft, setFolderDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [submittingFolder, setSubmittingFolder] = useState(false)
  const [panelLeft, setPanelLeft] = useState(316)

  const menuNote = notes.find((n) => n.id === folderMenuNoteId) ?? null
  const reminderNoteIds = useMemo(
    () => new Set(reminders.filter((r) => !r.fired).map((r) => r.note_id)),
    [reminders],
  )
  const flatFolders = useMemo(() => flattenFolders(folders), [folders])

  useEffect(() => {
    if (!folderMenuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFolderMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folderMenuOpen, closeFolderMenu])

  useEffect(() => {
    const update = () => {
      // Coordinates inside the zoomed root use layout pixels; the viewport is
      // reported in device CSS pixels, so normalize before clamping.
      const zoom = uiZoom / 100
      const available = window.innerWidth / zoom
      const desired = focusMode ? 16 : sidebarWidth + 24
      setPanelLeft(Math.max(8, Math.min(desired, available - 344)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [focusMode, sidebarWidth, uiZoom])

  useEffect(() => {
    if (folderMenuOpen) return
    setFolderFormParent(undefined)
    setFolderDraft('')
    setRenamingId(null)
    setRenameDraft('')
    setDropTarget(null)
  }, [folderMenuOpen])

  if (!folderMenuOpen) return null

  const startNewFolder = (parentId: string | null = null) => {
    setFolderFormParent(parentId)
    setFolderDraft('')
    setRenamingId(null)
  }

  const submitNewFolder = async () => {
    if (submittingFolder) return
    const value = folderDraft.trim()
    if (!value) {
      setFolderFormParent(undefined)
      return
    }
    const parentId = folderFormParent ?? null
    const color = folderColors[folders.length % folderColors.length]
    setSubmittingFolder(true)
    setFolderFormParent(undefined)
    setFolderDraft('')
    try {
      await createFolder(value, color, parentId)
    } finally {
      setSubmittingFolder(false)
    }
  }

  const startRename = (folder: Folder) => {
    setRenamingId(folder.id)
    setRenameDraft(folder.name)
    setFolderFormParent(undefined)
  }

  const submitRename = async () => {
    if (!renamingId) return
    const value = renameDraft.trim()
    const id = renamingId
    setRenamingId(null)
    if (value) await renameFolder(id, value)
  }

  const resolveDropNote = (event: DragEvent<HTMLDivElement>) =>
    event.dataTransfer.getData('application/x-localmind-note')
      || event.dataTransfer.getData('text/plain')
      || draggingNoteId
      || folderMenuNoteId
      || selectedId

  const isNoteDrag = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer.types).includes('application/x-localmind-note')
      || Boolean(draggingNoteId)
      || Boolean(folderMenuNoteId)

  const runDrop = async (id: string, operation: () => Promise<void>) => {
    setDropTarget(null)
    // Ignore native file drops or stale ids instead of silently updating zero rows.
    if (!notes.some((note) => note.id === id)) {
      closeFolderMenu()
      return
    }
    try {
      await operation()
    } finally {
      closeFolderMenu()
    }
  }

  const allowDrop = (event: DragEvent<HTMLDivElement>, key: string) => {
    if (!isNoteDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(key)
  }

  const dropIntoFolder = (event: DragEvent<HTMLDivElement>, folderId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    const id = resolveDropNote(event)
    if (!id) return
    void runDrop(id, async () => {
      await api.setNoteTrashed(id, false)
      await api.setNoteArchived(id, false)
      await moveNote(id, folderId)
    })
  }

  const dropIntoArchive = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const id = resolveDropNote(event)
    if (!id) return
    void runDrop(id, () => archiveNote(id, true))
  }

  const dropIntoTrash = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const id = resolveDropNote(event)
    if (!id) return
    void runDrop(id, () => trashNote(id))
  }

  const chooseFolder = (folderId: string | null) => {
    if (menuNote) {
      void dropIntoFolderLikeNote(menuNote.id, folderId)
      return
    }
    setFilter(folderId ? { kind: 'folder', id: folderId } : { kind: 'all' })
    closeFolderMenu()
  }

  const dropIntoFolderLikeNote = async (noteId: string, folderId: string | null) => {
    await api.setNoteTrashed(noteId, false)
    await api.setNoteArchived(noteId, false)
    await moveNote(noteId, folderId)
    closeFolderMenu()
  }

  const chooseArchive = () => {
    if (menuNote) {
      void archiveNote(menuNote.id, true).then(closeFolderMenu)
      return
    }
    setFilter({ kind: 'archive' })
    closeFolderMenu()
  }

  const chooseTrash = () => {
    if (menuNote) {
      void trashNote(menuNote.id).then(closeFolderMenu)
      return
    }
    setFilter({ kind: 'trash' })
    closeFolderMenu()
  }

  const destinationProps = (key: string, onDrop?: (event: DragEvent<HTMLDivElement>) => void) => ({
    onDragOver: (event: DragEvent<HTMLDivElement>) => allowDrop(event, key),
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null
      if (next && event.currentTarget.contains(next)) return
      setDropTarget((current) => (current === key ? null : current))
    },
    onDrop,
    highlight: dropTarget === key,
  })

  const folderForm = (parentId: string | null, placeholder: string, compact = false) => (
    <div className={cn('px-2', compact ? 'pb-1 pt-1' : 'py-2')} style={compact ? undefined : { paddingLeft: parentId ? 20 : 12 }}>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={folderDraft}
          onChange={(event) => setFolderDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitNewFolder()
            if (event.key === 'Escape') {
              setFolderFormParent(undefined)
              setFolderDraft('')
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn('min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-2 text-[12px] outline-none', compact ? 'h-7' : 'h-8')}
        />
        <IconButton label="Save folder" className="h-7 w-7" onClick={() => void submitNewFolder()}>
          <Check size={13} />
        </IconButton>
        <IconButton
          label="Cancel new folder"
          className="h-7 w-7"
          onClick={() => {
            setFolderFormParent(undefined)
            setFolderDraft('')
          }}
        >
          <X size={13} />
        </IconButton>
      </div>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-label="Folders and views"
      style={{ left: panelLeft, top: 104 }}
      className="glass-panel fixed z-40 flex max-h-[calc(100vh-128px)] w-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] shadow-soft"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">Folders &amp; views</div>
          <div className="truncate text-[10px] text-[var(--faint)]">
            {menuNote
              ? `Move “${menuNote.title || 'Untitled note'}”`
              : 'Add, open, and organize folders'}
          </div>
        </div>
        <IconButton label="Close folders" className="h-7 w-7" onClick={closeFolderMenu}>
          <X size={14} />
        </IconButton>
      </div>

      <div className="shrink-0 border-b border-[var(--border)] p-2">
        <button
          onClick={() => startNewFolder(null)}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2.4} />
          New folder
        </button>
        {folderFormParent === null && folderForm(null, 'Folder name')}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Views</div>
        <DestinationRow
          icon={<FileText size={14} />}
          label="All notes"
          count={notes.filter((n) => !n.trashed).length}
          active={filter.kind === 'all'}
          onClick={() => chooseFolder(null)}
          {...destinationProps('all', (event) => dropIntoFolder(event, null))}
        />
        <DestinationRow
          icon={<BellRing size={14} />}
          label="Reminders"
          count={reminderNoteIds.size}
          active={filter.kind === 'reminders'}
          onClick={() => {
            setFilter({ kind: 'reminders' })
            closeFolderMenu()
          }}
        />
        <DestinationRow
          icon={<Archive size={14} />}
          label="Archive"
          count={notes.filter((n) => n.archived && !n.trashed).length}
          active={filter.kind === 'archive'}
          onClick={chooseArchive}
          {...destinationProps('archive', dropIntoArchive)}
        />
        <DestinationRow
          icon={<Trash2 size={14} />}
          label="Deleted"
          count={notes.filter((n) => n.trashed).length}
          active={filter.kind === 'trash'}
          onClick={chooseTrash}
          {...destinationProps('trash', dropIntoTrash)}
        />

        <div className="mb-1 mt-3 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Your folders</span>
          <IconButton label="New root folder" className="h-6 w-6" onClick={() => startNewFolder(null)}>
            <Plus size={13} />
          </IconButton>
        </div>

        {flatFolders.length === 0 && folderFormParent === undefined && (
          <p className="px-2 py-2 text-[11px] text-[var(--faint)]">
            No folders yet. Use <span className="font-medium text-[var(--text)]">New folder</span> above.
          </p>
        )}

        {flatFolders.map(({ folder, depth }) => (
          <div key={folder.id}>
            {renamingId === folder.id ? (
              <div className="flex items-center gap-1 py-1 pr-2" style={{ paddingLeft: 10 + depth * 12 }}>
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitRename()
                    if (event.key === 'Escape') setRenamingId(null)
                  }}
                  placeholder="Folder name"
                  aria-label="Folder name"
                  className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-2 text-[12px] outline-none"
                />
                <IconButton label="Save folder name" className="h-7 w-7" onClick={() => void submitRename()}>
                  <Check size={13} />
                </IconButton>
                <IconButton label="Cancel rename" className="h-7 w-7" onClick={() => setRenamingId(null)}>
                  <X size={13} />
                </IconButton>
              </div>
            ) : (
              <DestinationRow
                icon={<FolderIcon size={14} />}
                label={folder.name}
                indent={depth}
                color={folder.color}
                count={notes.filter((n) => n.folder_id === folder.id && !n.trashed).length}
                active={filter.kind === 'folder' && filter.id === folder.id}
                onClick={() => chooseFolder(folder.id)}
                trailing={(
                  <span className="flex items-center gap-0.5">
                    <IconButton
                      label={`Rename ${folder.name}`}
                      className="h-5 w-5"
                      onClick={(event) => {
                        event.stopPropagation()
                        startRename(folder)
                      }}
                    >
                      <Pencil size={11} />
                    </IconButton>
                    <IconButton
                      label={`New subfolder in ${folder.name}`}
                      className="h-5 w-5"
                      onClick={(event) => {
                        event.stopPropagation()
                        startNewFolder(folder.id)
                      }}
                    >
                      <Plus size={11} />
                    </IconButton>
                  </span>
                )}
                {...destinationProps(`folder-${folder.id}`, (event) => dropIntoFolder(event, folder.id))}
              />
            )}

            {folderFormParent === folder.id && folderForm(folder.id, 'Subfolder name', true)}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] p-2">
        {filter.kind === 'folder' && (
          <div className="flex gap-1">
            <button
              onClick={() => void (async () => {
                const folderName = folders.find((f) => f.id === filter.id)?.name || 'folder'
                const target = await save({
                  filters: [{ name: 'Markdown', extensions: ['md'] }],
                  defaultPath: `${folderName}.md`,
                })
                if (target) await api.exportFolder(filter.id, target)
              })()}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
            >
              <Download size={12} /> Export folder
            </button>
            <button
              onClick={() => void (async () => {
                const confirmed = await ask(
                  'Delete this folder? Notes inside will be unfiled, not deleted.',
                  { title: 'Delete folder', kind: 'warning' },
                )
                if (!confirmed) return
                await deleteFolder(filter.id)
                closeFolderMenu()
              })()}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
            >
              <Trash2 size={12} /> Delete folder
            </button>
          </div>
        )}
        {filter.kind === 'trash' && notes.some((n) => n.trashed) && (
          <button
            onClick={() => void emptyTrash()}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          >
            <Trash2 size={12} /> Empty trash
          </button>
        )}
        <p className="px-2 py-1 text-center text-[10px] text-[var(--faint)]">
          {menuNote ? 'Drop on a folder to move this note, or click one.' : 'Click to browse · drag a note onto a folder to organize.'}
        </p>
      </div>
    </div>
  )
}
