import { useEffect, useRef, useState } from 'react'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Sparkles } from 'lucide-react'
import { api } from '../../lib/api'
import { applyPalette, applyVisualSettings, getTheme } from '../../themes'
import type { Appearance, Setting } from '../../types'

export function QuickCapture() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('dark')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void api.getSettings().then((settings) => {
      const map = new Map(settings.map((s: Setting) => [s.key, s.value]))
      const appearance = (map.get('appearance') || 'dark') as Appearance
      const mode = appearance === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : appearance
      applyPalette(getTheme(map.get('theme') || 'midnight')[mode], map.get('accent') || '', mode)
      const glass = Number(map.get('glass') ?? 55)
      const zoom = Number(map.get('zoom') ?? 100)
      applyVisualSettings(
        Number.isFinite(glass) ? Math.min(100, Math.max(0, glass)) : 55,
        Number.isFinite(zoom) ? Math.min(140, Math.max(80, zoom)) : 100,
      )
      setColorMode(mode)
    })
    window.setTimeout(() => titleRef.current?.focus(), 80)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void getCurrentWindow().hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const close = () => {
    void getCurrentWindow().hide()
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await api.createNote(title.trim() || 'Quick note', body.trim())
      await emit('notes-changed')
      setTitle('')
      setBody('')
      close()
    } catch {
      // Keep the draft and the window open so the user can retry.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]" data-color-mode={colorMode}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
        <Sparkles size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold tracking-tight">Quick capture</span>
        <div className="flex-1" />
        <button onClick={close} className="rounded px-1.5 text-[10px] text-[var(--faint)] hover:text-[var(--text)]">ESC</button>
      </div>
      <div className="flex-1 px-4 py-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'Enter') void save()
          }}
          placeholder="Note title"
          className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-[var(--faint)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
          }}
          placeholder="Write anything…"
          className="mt-3 h-[150px] w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-[var(--faint)]"
        />
      </div>
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--border)] px-4 text-[10px] text-[var(--faint)]">
        <span>Saved locally · private</span>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-[var(--accent)] px-2.5 py-1 font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50"
        >
          Save · Ctrl+Enter
        </button>
      </div>
    </div>
  )
}
