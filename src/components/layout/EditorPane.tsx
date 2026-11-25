import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type LiHTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react'
import MDEditor, { commands, type ICommand, type RefMDEditor } from '@uiw/react-md-editor'
import remarkBreaks from 'remark-breaks'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  Archive,
  ArchiveRestore,
  BellRing,
  Download,
  FilePlus2,
  Folder as FolderIcon,
  Pencil,
  Maximize2,
  Paperclip,
  Pin,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn, formatReminder, fromLocalInput, toLocalInput } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import { Button, EmptyState, Field, IconButton, Modal, TextInput } from '../ui'

const FORMAT_COMMANDS: ICommand[] = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.hr,
  commands.heading1,
  commands.heading2,
  commands.heading3,
  commands.link,
  commands.quote,
  commands.code,
  commands.codeBlock,
  commands.image,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.checkedListCommand,
  commands.table,
]

const TASK_LINE_RE = /^((?:\s*>\s*)*(?:\s*)(?:[-+*]|\d+[.)])\s+\[)( |x|X)(\])/

function taskLineNumbers(markdown: string) {
  return markdown
    .split('\n')
    .map((line, index) => (TASK_LINE_RE.test(line) ? index + 1 : null))
    .filter((line): line is number => line !== null)
}

function setTaskCheckedAtLine(markdown: string, lineNo: number, checked: boolean) {
  const lines = markdown.split('\n')
  const index = lineNo - 1
  const line = lines[index]
  if (line === undefined) return markdown
  const next = line.replace(
    TASK_LINE_RE,
    (_match, prefix: string, _mark: string, close: string) => `${prefix}${checked ? 'x' : ' '}${close}`,
  )
  if (next === line) return markdown
  lines[index] = next
  return lines.join('\n')
}

function PreviewTaskLine({
  node,
  className,
  children,
  ...rest
}: LiHTMLAttributes<HTMLLIElement> & { node?: unknown }) {
  const line = (node as { position?: { start?: { line?: number } } } | undefined)?.position?.start?.line
  const isTask = String(className ?? '').includes('task-list-item')
  return (
    <li {...rest} className={className} data-task-line={isTask && line ? line : undefined}>
      {children}
    </li>
  )
}

export function EditorPane() {
  const {
    notes,
    selectedId,
    folders,
    attachments,
    reminders,
    editMode,
    focusMode,
    setFocusMode,
    setEditMode,
    updateNote,
    togglePin,
    toggleArchive,
    trashNote,
    restoreNote,
    moveNote,
    addAttachment,
    removeAttachment,
    addReminder,
    deleteReminder,
    selectNote,
    registerPendingSave,
    openFolderMenu,
    themeId,
    appearance,
    settingsOpen,
    commandOpen,
    folderMenuOpen,
  } = useAppStore()

  const colorMode = appearance === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : appearance

  const note = notes.find((n) => n.id === selectedId) ?? null
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(true)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [due, setDue] = useState('')
  const saveTimer = useRef<number | null>(null)
  const saveGeneration = useRef(0)
  const synced = useRef<{ id: string; title: string; body: string } | null>(null)
  const editorRef = useRef<RefMDEditor>(null)
  const editorAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!note) {
      synced.current = null
      setTitle('')
      setBody('')
      return
    }
    // Only pull store values into the local draft when the note changed or the
    // draft still matches what was last sent to the store. Otherwise an autosave
    // completing mid-typing would overwrite newer keystrokes.
    const sameNote = synced.current?.id === note.id
    const untouched = sameNote
      && synced.current?.title === title
      && synced.current?.body === body
    if (!sameNote || untouched) {
      setTitle(note.title)
      setBody(note.body)
      synced.current = { id: note.id, title: note.title, body: note.body }
    }
    saveGeneration.current += 1
    setSaved(true)
  }, [note?.id, note?.title, note?.body])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  // Native file drop: copy dropped files into the note's attachments.
  useEffect(() => {
    if (!note) return
    let cancelled = false
    let unlisten: (() => void) | undefined
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'drop') {
          for (const path of payload.paths) void addAttachment(note.id, path)
        }
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [note?.id, addAttachment])

  const persistDraft = useCallback(async () => {
    const target = synced.current
    if (!target) return
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const generation = ++saveGeneration.current
    await updateNote(target.id, target.title, target.body)
    if (generation === saveGeneration.current) setSaved(true)
  }, [updateNote])

  useEffect(() => {
    registerPendingSave(persistDraft)
    return () => registerPendingSave(null)
  }, [persistDraft, registerPendingSave])

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!note) return
    synced.current = { id: note.id, title: nextTitle, body: nextBody }
    saveGeneration.current += 1
    setSaved(false)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void persistDraft()
    }, 550)
  }

  const onTitle = (value: string) => {
    setTitle(value)
    scheduleSave(value, body)
  }

  const onBody = (value?: string) => {
    const next = value ?? ''
    setBody(next)
    scheduleSave(title, next)
  }

  const toggleTaskCheckbox = useCallback((checkbox: HTMLInputElement, checked = !checkbox.checked) => {
    const item = checkbox.closest<HTMLLIElement>('li.task-list-item')
    if (!item) return
    const root = item.closest('.w-md-editor-preview') ?? document
    const items = Array.from(root.querySelectorAll<HTMLLIElement>('li.task-list-item'))
    const position = items.indexOf(item)
    const lineNumbers = taskLineNumbers(body)
    const dataLine = Number(item.dataset.taskLine)
    const lineNo = Number.isFinite(dataLine) && dataLine > 0 ? dataLine : lineNumbers[position]
    if (!lineNo) return

    const next = setTaskCheckedAtLine(body, lineNo, checked)
    if (next !== body) onBody(next)
  }, [body, onBody])

  const handlePreviewClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const item = target.closest<HTMLLIElement>('li.task-list-item')
    if (!item || !event.currentTarget.contains(item)) return
    const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (checkbox) toggleTaskCheckbox(checkbox)
  }

  const previewOptions = useMemo(
    () => ({
      remarkPlugins: [remarkBreaks],
      components: {
        li: PreviewTaskLine,
        input: (props: InputHTMLAttributes<HTMLInputElement>) => {
          if (props.type !== 'checkbox') return <input {...props} />
          return (
            <input
              {...props}
              disabled={false}
              readOnly
              onClick={(event) => {
                event.stopPropagation()
                toggleTaskCheckbox(event.currentTarget, event.currentTarget.checked)
              }}
            />
          )
        },
      },
    }),
    [toggleTaskCheckbox],
  )

  // Ctrl+A is scoped to the note editor/preview. Other text fields (title,
  // search, settings, dialogs) keep their native select-all behavior.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
      if (settingsOpen || commandOpen || folderMenuOpen || reminderOpen || !selectedId) return

      const area = editorAreaRef.current
      if (!area) return
      const target = event.target as Element | null
      const active = document.activeElement as HTMLElement | null
      const insideEditor = !!target && area.contains(target) || !!active && area.contains(active)
      const noConflictingFocus = !active || active === document.body || active === document.documentElement
      if (!insideEditor && !noConflictingFocus) return

      event.preventDefault()
      event.stopPropagation()

      if (editMode) {
        const textarea = area.querySelector<HTMLTextAreaElement>('textarea')
        if (!textarea) return
        textarea.focus({ preventScroll: true })
        textarea.select()
        return
      }

      const preview = area.querySelector<HTMLElement>('.w-md-editor-preview')
      const selection = window.getSelection()
      if (!preview || !selection) return
      area.focus({ preventScroll: true })
      const range = document.createRange()
      range.selectNodeContents(preview)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [editMode, selectedId, settingsOpen, commandOpen, folderMenuOpen, reminderOpen])

  if (!note) {
    return (
      <main className="flex h-full flex-1 items-center justify-center bg-[var(--bg)]">
        <EmptyState
          icon={<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]"><FilePlus2 size={28} /></div>}
          title="Select a note or create a new one"
          description="Everything stays on this device. Press Ctrl+N from anywhere to capture a thought."
        />
      </main>
    )
  }

  const noteReminders = reminders.filter((r) => r.note_id === note.id)
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[var(--bg)]" data-color-mode={colorMode}>
      <div className="glass-panel flex h-[60px] shrink-0 items-center gap-1 border-b border-[var(--border)] px-4">
        <select
          value={note.folder_id ?? ''}
          onChange={(e) => void moveNote(note.id, e.target.value || null)}
          className="h-8 max-w-[160px] rounded-lg bg-transparent px-2 text-xs text-[var(--muted)] outline-none hover:bg-[var(--surface-2)]"
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <IconButton label="Open folders, add a folder, or move this note" onClick={() => openFolderMenu(note.id)}>
          <FolderIcon size={15} />
        </IconButton>

        <div className="mx-1 h-5 w-px bg-[var(--border)]" />

        <IconButton label={editMode ? 'Preview mode (Ctrl+E)' : 'Edit mode (Ctrl+E)'} active={editMode} onClick={() => setEditMode(!editMode)}>
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Focus mode (Ctrl+Shift+F / Ctrl+0)" active={focusMode} onClick={() => setFocusMode(!focusMode)}>
          <Maximize2 size={15} />
        </IconButton>
        <IconButton label={note.pinned ? 'Unpin' : 'Pin'} active={note.pinned} onClick={() => void togglePin(note.id)}>
          <Pin size={15} />
        </IconButton>

        <IconButton label="Attach file" onClick={() => void (async () => {
          const picked = await open({ multiple: false, directory: false })
          if (picked) await addAttachment(note.id, picked)
        })()}>
          <Paperclip size={15} />
        </IconButton>
        <IconButton label="Add reminder" active={noteReminders.length > 0} onClick={() => { setDue(toLocalInput(new Date(Date.now() + 3600_000).toISOString())); setReminderOpen(true) }}>
          <BellRing size={15} />
        </IconButton>

        <div className="flex-1" />

        <IconButton label="Export as Markdown" onClick={() => void (async () => {
          const target = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            defaultPath: `${(note.title || 'note').replace(/[^\w\- ]/g, '')}.md`,
          })
          if (target) await api.exportMarkdown([note.id], target)
        })()}>
          <Download size={15} />
        </IconButton>
        <IconButton label={note.archived ? 'Unarchive' : 'Archive'} active={note.archived} onClick={() => void toggleArchive(note.id)}>
          {note.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
        </IconButton>
        <IconButton label={note.trashed ? 'Restore note' : 'Move to trash'} className={cn(!note.trashed && 'hover:text-[var(--danger)]')} onClick={() => void (note.trashed ? restoreNote(note.id) : trashNote(note.id))}>
          {note.trashed ? <RotateCcw size={15} /> : <Trash2 size={15} />}
        </IconButton>
      </div>

      <div className="glass-panel flex h-10 shrink-0 items-center gap-0.5 border-b border-[var(--border)] px-4">
        <span className="mr-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">Format</span>
        {FORMAT_COMMANDS.map((command, index) => (
          <span key={command.name ?? command.keyCommand ?? index} className="flex items-center">
            {(index === 4 || index === 8 || index === 12) && (
              <span className="mx-1.5 h-4 w-px bg-[var(--border)]" />
            )}
            <button
              type="button"
              title={String(command.buttonProps?.title ?? command.name ?? '')}
              aria-label={String(command.buttonProps?.['aria-label'] ?? command.name ?? '')}
              disabled={!editMode}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editorRef.current?.commandOrchestrator?.executeCommand(command)}
              className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {command.icon ?? <span className="text-[10px]">{command.name}</span>}
            </button>
          </span>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-8 pt-6">
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            readOnly={!editMode}
            placeholder="Untitled note"
            className={cn(
              'w-full bg-transparent text-[2rem] font-semibold tracking-[-0.035em] outline-none placeholder:text-[var(--faint)]',
              !editMode && 'cursor-default',
            )}
          />

          <div className="title-divider" aria-hidden="true">
            <span className="divider-line" />
            <span className="divider-gem" />
            <span className="divider-line" />
          </div>

          {noteReminders.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {noteReminders.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--accent)]">
                  <BellRing size={12} />
                  {formatReminder(r.due_at)}
                  <button onClick={() => void deleteReminder(r.id)} className="opacity-70 hover:opacity-100" aria-label="Remove reminder">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            ref={editorAreaRef}
            tabIndex={-1}
            className="mt-6 min-h-0 flex-1 outline-none"
            onClick={handlePreviewClick}
            onMouseDown={(event) => {
              const target = event.target as HTMLElement
              if (target.closest('input, textarea, button, a, [role="checkbox"]')) return
              editorAreaRef.current?.focus({ preventScroll: true })
            }}
          >
            <MDEditor
              ref={editorRef}
              value={body}
              onChange={onBody}
              preview={editMode ? 'edit' : 'preview'}
              visibleDragbar={false}
              hideToolbar
              height="100%"
              previewOptions={previewOptions}
              textareaProps={{ readOnly: !editMode, placeholder: 'Start writing in Markdown…' }}
            />
          </div>

          {attachments.length > 0 && (
            <div className="mt-8">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Attachments</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <div key={file.id} className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs">
                    <Paperclip size={12} className="text-[var(--muted)]" />
                    <span className="max-w-[180px] truncate">{file.filename}</span>
                    <span className="text-[10px] text-[var(--faint)]">{(file.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => void removeAttachment(file.id, note.id)} className="text-[var(--faint)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)]" aria-label="Remove attachment">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel flex h-8 shrink-0 items-center justify-between border-t border-[var(--border)] px-4 text-[10px] text-[var(--faint)]">
        <span>{wordCount} words · {body.length} characters</span>
        <div className="flex items-center gap-3">
          <span>{editMode ? 'Editing · Ctrl+E for preview' : 'Preview · Ctrl+E to edit'}</span>
          <span className={cn('flex items-center gap-1.5', saved ? 'text-[var(--faint)]' : 'text-[var(--accent)]')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', saved ? 'bg-[var(--faint)]' : 'animate-pulse bg-[var(--accent)]')} />
            {saved ? 'Saved locally' : 'Saving…'}
          </span>
        </div>
      </div>

      <Modal open={reminderOpen} onClose={() => setReminderOpen(false)} title="Set a reminder">
        <div className="space-y-4">
          <Field label="Remind me on" hint="Reminders show in the app and send a Windows notification while it is running.">
            <TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReminderOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!due) return
                void addReminder(note.id, fromLocalInput(due)).then(() => setReminderOpen(false))
              }}
            >
              Set reminder
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  )
}
