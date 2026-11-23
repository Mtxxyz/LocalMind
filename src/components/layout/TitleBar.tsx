import { exit } from '@tauri-apps/api/app'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize2, Minus, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export function TitleBar() {
  const win = getCurrentWindow()
  const flushPendingSave = useAppStore((s) => s.flushPendingSave)

  return (
    <div
      data-tauri-drag-region
      onMouseDown={(e) => {
        if (e.button === 0) void win.startDragging()
      }}
      className="glass-panel flex h-9 shrink-0 items-center justify-between border-b border-[var(--border)] px-3"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)]">
          <span className="text-[10px] font-bold">L</span>
        </div>
        <span className="text-[12px] font-medium text-[var(--muted)]">LocalMind</span>
      </div>
      <div className="flex items-center" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => void (async () => {
            await win.setSkipTaskbar(false)
            await win.minimize()
          })()}
          className="flex h-9 w-11 items-center justify-center text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => void win.toggleMaximize()}
          className="flex h-9 w-11 items-center justify-center text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="Maximize"
        >
          <Maximize2 size={12} />
        </button>
        <button
          onClick={() => void (async () => {
            try {
              await flushPendingSave()
            } catch {
              // Exit even if the final autosave failed.
            }
            await exit(0)
          })()}
          className="flex h-9 w-11 items-center justify-center text-[var(--muted)] transition-colors hover:bg-[var(--danger)] hover:text-white"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}