import { useEffect, useRef, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  Archive,
  ArchiveRestore,
  BellRing,
  Download,
  FilePlus2,
  Hash,
  Paperclip,
  Pin,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn, formatReminder, fromLocalInput, toLocalInput } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import { Button, EmptyState, Field, IconButton, Modal, TextInput } from '../ui'

export function EditorPane() {
  const {
    notes,
    selectedId,
    folders,
    tags,
    attachments,
    reminders,
    editMode,
    setEditMode,
    updateNote,
    togglePin,
    toggleArchive,
    trashNote,
    restoreNote,
    moveNote,
    createTagForNote,
    toggleNoteTag,
    addAttachment,
    removeAttachment,
    addReminder,
    deleteReminder,
    selectNote,
    themeId,
    appearance,
  } = useAppStore()

  const colorMode = appearance === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : appearance

  const note = notes.find((n) => n.id === selectedId) ?? null
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(true)
  const [tagOpen, setTagOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [reminderOpen, setReminderOpen] = useState(false)
  const [due, setDue] = useState('')
  const saveTimer = useRef<number | null>(null)
  const synced = useRef<{ id: string; title: string; body: string } | null>(null)

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

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!note) return
    synced.current = { id: note.id, title: nextTitle, body: nextBody }
    setSaved(false)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void updateNote(note.id, nextTitle, nextBody).then(() => setSaved(true))
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
      <div className="flex h-[60px] shrink-0 items-center gap-1 border-b border-[var(--border)] px-4">
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

        <div className="mx-1 h-5 w-px bg-[var(--border)]" />

        <IconButton label={editMode ? 'Preview mode (Ctrl+E)' : 'Edit mode (Ctrl+E)'} active={editMode} onClick={() => setEditMode(!editMode)}>
          <Hash size={15} />
        </IconButton>
        <IconButton label={note.pinned ? 'Unpin' : 'Pin'} active={note.pinned} onClick={() => void togglePin(note.id)}>
          <Pin size={15} />
        </IconButton>

        <div className="relative">
          <IconButton label="Tags" active={tagOpen} onClick={() => setTagOpen((v) => !v)}>
            <Tag size={15} />
          </IconButton>
          {tagOpen && (
            <div className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-2 shadow-soft">
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => void toggleNoteTag(note.id, tag.id)}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-lg px-2 text-xs hover:bg-[var(--surface-2)]',
                      note.tags.some((t) => t.id === tag.id) ? 'text-[var(--accent)]' : 'text-[var(--muted)]',
                    )}
                  >
                    <Hash size={12} />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {note.tags.some((t) => t.id === tag.id) && <span className="text-[var(--accent)]">✓</span>}
                  </button>
                ))}
              </div>
              <form
                className="mt-2 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!tagDraft.trim()) return
                  void createTagForNote(note.id, tagDraft).then(() => setTagDraft(''))
                }}
              >
                <TextInput value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="New tag" className="h-7 text-xs" />
                <Button size="sm" type="submit">Add</Button>
              </form>
            </div>
          )}
        </div>

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

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 pb-16 pt-9">
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

          {note.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => void toggleNoteTag(note.id, tag.id)}
                  className="group flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
                >
                  #{tag.name}
                  <X size={10} className="opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}

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

          <div className="mt-6">
            <MDEditor
              value={body}
              onChange={onBody}
              preview={editMode ? 'edit' : 'preview'}
              visibleDragbar={false}
              hideToolbar={!editMode}
              height={520}
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

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--border)] px-4 text-[10px] text-[var(--faint)]">
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
          <Field label="Remind me on" hint="Reminders are shown in the app while it is running.">
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
