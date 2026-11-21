import { useEffect, useState } from 'react'
import { KeyRound, LockKeyhole, ShieldOff } from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Field, TextInput } from '../ui'

export function PasswordSettings() {
  const [hasPassword, setHasPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void api.hasPassword().then(setHasPassword)
  }, [])

  const set = async () => {
    setError('')
    if (password.length < 4) return setError('Use at least 4 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    if (hasPassword && current) {
      const ok = await api.verifyPassword(current)
      if (!ok) return setError('Current password is incorrect.')
    }
    await api.setPassword(password)
    setHasPassword(true)
    setPassword('')
    setConfirm('')
    setCurrent('')
    setMessage('Password updated.')
  }

  const remove = async () => {
    setError('')
    const ok = await api.verifyPassword(current)
    if (!ok) return setError('Current password is incorrect.')
    await api.removePassword()
    setHasPassword(false)
    setCurrent('')
    setMessage('Password removed.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
          {hasPassword ? <LockKeyhole size={17} /> : <ShieldOff size={17} />}
        </div>
        <div>
          <div className="text-[13px] font-medium">{hasPassword ? 'App lock is enabled' : 'No app lock set'}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {hasPassword
              ? 'LocalMind asks for a password when it starts. Notes are stored locally and are not encrypted at rest.'
              : 'Add a password so only you can open the app. This does not encrypt the database file.'}
          </p>
        </div>
      </div>

      {hasPassword && (
        <Field label="Current password">
          <TextInput type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setError('') }} placeholder="Current password" />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={hasPassword ? 'New password' : 'Password'}>
          <TextInput type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} placeholder="At least 4 characters" />
        </Field>
        <Field label="Confirm password">
          <TextInput type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }} placeholder="Repeat password" />
        </Field>
      </div>

      {(error || message) && (
        <p className={`text-[11px] ${error ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>{error || message}</p>
      )}

      <div className="flex justify-end gap-2">
        {hasPassword && (
          <Button variant="danger" onClick={() => void remove()} disabled={!current}>
            Remove password
          </Button>
        )}
        <Button variant="primary" onClick={() => void set()} disabled={!password || !confirm}>
          <KeyRound size={14} />
          {hasPassword ? 'Update password' : 'Set password'}
        </Button>
      </div>
    </div>
  )
}
