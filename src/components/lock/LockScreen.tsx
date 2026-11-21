import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useAppStore } from '../../stores/useAppStore'
import { Button, TextInput } from '../ui'

export function LockScreen() {
  const setUnlocked = useAppStore((s) => s.setUnlocked)
  const loadAll = useAppStore((s) => s.loadAll)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void api.hasPassword()
      .then((has) => {
        if (!has) {
          setUnlocked(true)
          void api.setAppLocked(false)
          void loadAll()
        } else {
          setChecking(false)
          window.setTimeout(() => inputRef.current?.focus(), 80)
        }
      })
      .catch(() => {
        setUnlocked(true)
        void api.setAppLocked(false)
        void loadAll()
      })
  }, [loadAll, setUnlocked])

  const unlock = async () => {
    const ok = await api.verifyPassword(password)
    if (ok) {
      setUnlocked(true)
      void api.setAppLocked(false)
      void loadAll()
    } else {
      setError('Incorrect password')
      setPassword('')
      inputRef.current?.focus()
    }
  }

  if (checking) {
    return <div className="flex h-full items-center justify-center bg-[var(--bg)]" />
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[var(--bg)]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
        className="relative w-[340px] rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-8 shadow-soft"
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
