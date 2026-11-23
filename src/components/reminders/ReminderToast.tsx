import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { PluginListener } from '@tauri-apps/api/core'
import { onAction } from '@tauri-apps/plugin-notification'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import type { Reminder } from '../../types'
import { IconButton } from '../ui'

export function ReminderToast() {
  const { reminders, refreshReminders, fireReminder, selectNote, notes, unlocked } = useAppStore()
  const [queue, setQueue] = useState<Reminder[]>([])
  const active = queue[0] ?? null
  const queued = useRef(new Set<string>())

  useEffect(() => {
    let listener: PluginListener | undefined
    void onAction((event) => {
      const extra = event.notification?.extra
      const noteId = extra?.noteId
      const reminderId = extra?.reminderId
      const window = getCurrentWindow()
      void window.show()
      void window.setFocus()
      if (typeof noteId === 'string') void selectNote(noteId)
      if (typeof reminderId === 'string') void fireReminder(reminderId)
    }).then((fn) => { listener = fn }).catch(() => {})
    return () => { void listener?.unregister() }
  }, [selectNote, fireReminder])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen<Reminder>('reminder-due', (event) => {
      const reminder = event.payload
      queued.current.add(reminder.id)
      setQueue((current) => (
        current.some((r) => r.id === reminder.id) ? current : [...current, reminder]
      ))
    }).then((fn) => { unlisten = fn }).catch(() => {})
    return () => { unlisten?.() }
  }, [])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const due = reminders.filter((r) => !r.fired && new Date(r.due_at).getTime() <= now)
      for (const reminder of due) {
        if (queued.current.has(reminder.id)) continue
        queued.current.add(reminder.id)
      }
      if (due.length > 0) {
        setQueue((current) => {
          const existing = new Set(current.map((r) => r.id))
          const additions = due.filter((r) => !existing.has(r.id))
          return additions.length ? [...current, ...additions] : current
        })
      }
    }
    check()
    const timer = window.setInterval(() => {
      if (unlocked) void refreshReminders()
    }, 12_000)
    return () => window.clearInterval(timer)
  }, [reminders, refreshReminders, unlocked])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      setQueue((current) => current.filter((r) => r.id !== active.id))
      queued.current.delete(active.id)
    }, 12_000)
    return () => window.clearTimeout(timer)
  }, [active])

  const dismiss = (openNote = false) => {
    if (!active) return
    void fireReminder(active.id)
    queued.current.delete(active.id)
    if (openNote) {
      const note = notes.find((n) => n.id === active.note_id)
      if (note) selectNote(note.id)
    }
    setQueue((current) => current.filter((r) => r.id !== active.id))
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="fixed bottom-5 right-5 z-40 w-[320px] rounded-2xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--elevated)] p-4 shadow-soft"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
              <BellRing size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Reminder</div>
              <button onClick={() => dismiss(true)} className="mt-1 block truncate text-left text-[13px] font-semibold hover:underline">
                {active.note_title || 'Untitled note'}
              </button>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">It's time to revisit this note.</p>
            </div>
            <IconButton label="Dismiss reminder" className="h-6 w-6" onClick={() => dismiss()}>
              <X size={13} />
            </IconButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
