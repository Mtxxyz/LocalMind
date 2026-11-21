import { useEffect, useMemo, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import {
  Archive,
  BellRing,
  Download,
  FilePlus2,
  FileText,
  Moon,
  Search,
  Settings2,
  Sun,
  Trash2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import { Modal } from '../ui'

export function CommandPalette() {
  const { commandOpen, setCommandOpen, createNote, setFilter, setSettingsOpen, setAppearance, appearance } = useAppStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!commandOpen) setQuery('')
  }, [commandOpen])

  const commands = useMemo(() => [
    { label: 'New note', hint: 'Ctrl+Shift+N', icon: <FilePlus2 size={15} />, run: () => void createNote() },
    { label: 'Go to all notes', icon: <FileText size={15} />, run: () => setFilter({ kind: 'all' }) },
    { label: 'Go to reminders', icon: <BellRing size={15} />, run: () => setFilter({ kind: 'reminders' }) },
    { label: 'Go to archive', icon: <Archive size={15} />, run: () => setFilter({ kind: 'archive' }) },
    { label: 'Go to trash', icon: <Trash2 size={15} />, run: () => setFilter({ kind: 'trash' }) },
    { label: 'Open settings', icon: <Settings2 size={15} />, run: () => setSettingsOpen(true) },
    {
      label: `Switch to ${appearance === 'dark' ? 'light' : 'dark'} mode`,
      icon: appearance === 'dark' ? <Sun size={15} /> : <Moon size={15} />,
      run: () => void setAppearance(appearance === 'dark' ? 'light' : 'dark'),
    },
    {
      label: 'Export JSON backup',
      icon: <Download size={15} />,
      run: () => void (async () => {
        const path = await save({
          filters: [{ name: 'LocalMind backup', extensions: ['json'] }],
          defaultPath: 'localmind-backup.json',
        })
        if (path) await api.exportBackup(path)
      })(),
    },
  ], [appearance, createNote, setFilter, setSettingsOpen, setAppearance])

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <Modal open={commandOpen} onClose={() => setCommandOpen(false)} width="max-w-lg">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              filtered[0].run()
              setCommandOpen(false)
            }
          }}
          placeholder="Type a command…"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="mt-3 max-h-72 space-y-0.5 overflow-y-auto">
        {filtered.map((command, index) => (
          <button
            key={command.label}
            onClick={() => { command.run(); setCommandOpen(false) }}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition-colors',
              index === 0 ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--text)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
            )}
          >
            <span className="text-[var(--accent)]">{command.icon}</span>
            <span className="flex-1 text-left">{command.label}</span>
            {command.hint && <span className="text-[10px] text-[var(--faint)]">{command.hint}</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--faint)]">No commands found</div>
        )}
      </div>
    </Modal>
  )
}
