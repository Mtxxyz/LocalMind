import { useEffect, useRef, useState } from 'react'
import { exit } from '@tauri-apps/api/app'
import { motion } from 'framer-motion'
import { LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { api } from '../../lib/api'
import { applyPalette, applyVisualSettings, getTheme } from '../../themes'
import { useAppStore } from '../../stores/useAppStore'
import type { Appearance, Setting } from '../../types'
import { Button, TextInput } from '../ui'

export function LockScreen() {
  const setUnlocked = useAppStore((s) => s.setUnlocked)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // The lock screen must use the saved theme before the notes are unlocked.
  useEffect(() => {
    void api.getSettings().then((settings) => {
      const map = new Map(settings.map((s: Setting) => [s.key, s.value]))
      const appearance = (map.get('appearance') || 'dark') as Appearance
      const mode = appearance === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : appearance
      const glassiness = Number(map.get('glass') ?? 55)
      const uiZoom = Number(map.get('zoom') ?? 100)
      applyPalette(getTheme(map.get('theme') || 'midnight')[mode], map.get('accent') || '', mode)
      applyVisualSettings(
        Number.isFinite(glassiness) ? glassiness : 55,
        Number.isFinite(uiZoom) ? uiZoom : 100,
      )
    }).catch(() => {})
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const has = await api.hasPassword()
        if (!has) {
          // The backend must be unlocked before App's loadAll effect runs.
          await api.setAppLocked(false)
          setUnlocked(true)
          return
        }
        setChecking(false)
        window.setTimeout(() => inputRef.current?.focus(), 80)
      } catch {
        setChecking(false)
        setError('Could not check the app lock. Restart LocalMind and try again.')
      }
    })()
  }, [setUnlocked])

  const unlock = async () => {
    try {
      const ok = await api.verifyPassword(password)
      if (!ok) {
        setError('Incorrect password')
        setPassword('')
        inputRef.current?.focus()
        return
      }
      await api.setAppLocked(false)
      setUnlocked(true)
    } catch {
      setError('Could not verify the password. Try again.')
    }
  }

  if (checking) {
    return <div className="flex h-full items-center justify-center bg-[var(--bg)]" />
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] blur-3xl" />
      <button
        onClick={() => void exit(0)}
        aria-label="Close LocalMind"
        title="Close LocalMind"
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
      >
        <X size={16} />
      </button>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
        className="glass-panel relative w-[340px] rounded-2xl border border-[var(--border)] p-8 shadow-soft"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">Enter your password to open LocalMind.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void unlock()
          }}
          className="space-y-3"
        >
          <div className="relative">
            <LockKeyhole size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <TextInput
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              className="pl-9"
            />
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={!password}>
            Unlock
          </Button>
        </form>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-[var(--faint)]">
          No account. No cloud. Your notes never leave this device.
        </p>
      </motion.div>
    </div>
  )
}
