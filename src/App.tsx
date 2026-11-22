import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PanelLeftOpen } from 'lucide-react'
import { QuickCapture } from './components/capture/QuickCapture'
import { CommandPalette } from './components/layout/CommandPalette'
import { EditorPane } from './components/layout/EditorPane'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { LockScreen } from './components/lock/LockScreen'
import { ReminderToast } from './components/reminders/ReminderToast'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { useAppStore } from './stores/useAppStore'

function isCaptureWindow(): boolean {
  try {
    return getCurrentWindow().label === 'capture'
  } catch {
    return window.location.pathname.includes('capture')
  }
}

export default function App() {
  const [capture] = useState(isCaptureWindow)
  const {
    unlocked,
    loadAll,
    refreshNotes,
    refreshReminders,
    createNote,
    editMode,
    setEditMode,
    focusMode,
    setFocusMode,
    setCommandOpen,
    setSettingsOpen,
    settingsOpen,
    commandOpen,
    refreshTheme,
  } = useAppStore()

  useEffect(() => {
    if (capture || !unlocked) return
    void loadAll()
  }, [capture, unlocked, loadAll])

  useEffect(() => {
    if (capture || !unlocked) return
    const unlisten = listen('notes-changed', () => {
      void refreshNotes()
      void refreshReminders()
    })
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [capture, unlocked, refreshNotes, refreshReminders])

  useEffect(() => {
    if (capture || !unlocked) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (e.shiftKey && key === 'n') {
        e.preventDefault()
        void createNote()
      } else if (e.shiftKey && key === 'f') {
        e.preventDefault()
        setFocusMode(!focusMode)
      } else if (key === '0') {
        e.preventDefault()
        setFocusMode(!focusMode)
      } else if (key === 'e') {
        e.preventDefault()
        setEditMode(!editMode)
      } else if (key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      } else if (key === 'f') {
        e.preventDefault()
        document.getElementById('note-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capture, unlocked, editMode, focusMode, setEditMode, setFocusMode, setCommandOpen, createNote])

  useEffect(() => {
    if (capture || !unlocked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (commandOpen) setCommandOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capture, unlocked, commandOpen, settingsOpen, setCommandOpen, setSettingsOpen])

  useEffect(() => {
    if (capture) return
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = () => {
      if (useAppStore.getState().appearance === 'system') refreshTheme()
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [capture, refreshTheme])

  if (capture) return <QuickCapture />
  if (!unlocked) return <LockScreen />

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent text-[var(--text)]">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {!focusMode && <Sidebar />}
        <EditorPane />
      </div>
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          title="Exit focus mode (Ctrl+Shift+F)"
          className="absolute bottom-12 right-5 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-soft hover:text-[var(--text)]"
        >
          <PanelLeftOpen size={15} />
        </button>
      )}
      <SettingsPanel />
      <CommandPalette />
      <ReminderToast />
    </div>
  )
}
