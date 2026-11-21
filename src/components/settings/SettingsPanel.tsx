import { useEffect, useState, type ReactNode } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Database, Download, Keyboard, Palette, ShieldCheck, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import { Button, Divider, Modal } from '../ui'
import { PasswordSettings } from './PasswordSettings'
import { ThemePicker } from './ThemePicker'

type Tab = 'appearance' | 'security' | 'data'

export function SettingsPanel() {
  const { settingsOpen, setSettingsOpen, loadAll } = useAppStore()
  const [tab, setTab] = useState<Tab>('appearance')
  const [dataPath, setDataPath] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (settingsOpen) void api.getDataPath().then(setDataPath)
  }, [settingsOpen])

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
    { id: 'security', label: 'Security', icon: <ShieldCheck size={15} /> },
    { id: 'data', label: 'Data', icon: <Database size={15} /> },
  ]

  const exportBackup = async () => {
    const target = await save({
      filters: [{ name: 'LocalMind backup', extensions: ['json'] }],
      defaultPath: 'localmind-backup.json',
    })
    if (!target) return
    await api.exportBackup(target)
    setStatus('Backup exported.')
  }

  const importBackup = async () => {
    const source = await open({ filters: [{ name: 'LocalMind backup', extensions: ['json'] }], multiple: false })
    if (!source) return
    await api.importBackup(source)
    await loadAll()
    setStatus('Backup restored.')
  }

  return (
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" width="max-w-2xl">
      <div className="flex gap-5">
        <nav className="w-36 shrink-0 space-y-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors',
                tab === item.id
                  ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-medium text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[340px] flex-1">
          {tab === 'appearance' && <ThemePicker />}
          {tab === 'security' && <PasswordSettings />}
          {tab === 'data' && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium text-[var(--muted)]">Local data folder</div>
                <div className="truncate rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[11px] text-[var(--muted)]">
                  {dataPath || 'Loading…'}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
                  All notes, attachments and settings live here. Nothing is uploaded anywhere.
                </p>
              </div>

              <Divider />

              <div className="space-y-3">
                <div className="text-xs font-medium text-[var(--muted)]">Backup & restore</div>
                <div className="flex gap-2">
                  <Button onClick={() => void exportBackup()}><Download size={14} /> Export JSON backup</Button>
                  <Button onClick={() => void importBackup()}><Upload size={14} /> Restore backup</Button>
                </div>
                {status && <p className="text-[11px] text-[var(--accent)]">{status}</p>}
              </div>

              <Divider />

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                  <Keyboard size={14} /> Keyboard shortcuts
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-[var(--faint)]">
                  <span>Quick capture (global)</span><kbd className="text-right text-[var(--muted)]">Ctrl + N</kbd>
                  <span>New note</span><kbd className="text-right text-[var(--muted)]">Ctrl + Shift + N</kbd>
                  <span>Toggle edit / preview</span><kbd className="text-right text-[var(--muted)]">Ctrl + E</kbd>
                  <span>Command palette</span><kbd className="text-right text-[var(--muted)]">Ctrl + K</kbd>
                  <span>Search</span><kbd className="text-right text-[var(--muted)]">Ctrl + F</kbd>
                  <span>Focus mode</span><kbd className="text-right text-[var(--muted)]">Ctrl + Shift + F</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
