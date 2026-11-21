import type { ReactNode } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/useAppStore'
import { themes } from '../../themes'
import type { Appearance } from '../../types'

export function ThemePicker() {
  const { themeId, appearance, accent, setTheme, setAppearance, setAccent } = useAppStore()

  const appearances: { id: Appearance; label: string; icon: ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={14} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={14} /> },
    { id: 'system', label: 'System', icon: <Monitor size={14} /> },
  ]

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--muted)]">Appearance</div>
        <div className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
          {appearances.map((item) => (
            <button
              key={item.id}
              onClick={() => void setAppearance(item.id)}
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors',
                appearance === item.id
                  ? 'bg-[var(--elevated)] font-medium text-[var(--text)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-[var(--muted)]">Theme template</div>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((theme) => {
            const active = theme.id === themeId
            return (
              <button
                key={theme.id}
                onClick={() => void setTheme(theme.id)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border p-2 text-left transition-all',
                  active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--faint)]',
                )}
              >
                <div className="mb-2 flex h-14 flex-col gap-1 overflow-hidden rounded-lg p-2" style={{ background: theme.dark.bg }}>
                  <div className="h-1.5 w-3/4 rounded-full" style={{ background: theme.dark.surface }} />
                  <div className="h-1.5 w-1/2 rounded-full" style={{ background: theme.dark.surface2 }} />
                  <div className="mt-auto h-1.5 w-2/3 rounded-full" style={{ background: theme.dark.accent }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium">{theme.name}</span>
                  {active && <Check size={12} className="text-[var(--accent)]" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-[var(--muted)]">Accent color</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accent || themes.find((t) => t.id === themeId)?.swatch || '#7c8cff'}
            onChange={(e) => void setAccent(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-1"
          />
          <div className="flex-1 text-[11px] text-[var(--faint)]">
            Override the template accent. Leave default by clearing.
          </div>
          {accent && (
            <button onClick={() => void setAccent('')} className="text-[11px] text-[var(--accent)] hover:underline">
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
