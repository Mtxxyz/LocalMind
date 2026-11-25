import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'subtle' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'subtle', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-[13px]',
        variant === 'primary' && 'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90',
        variant === 'ghost' && 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
        variant === 'subtle' && 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--elevated)]',
        variant === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
        className,
      )}
      {...props}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

export function IconButton({ label, active, className, ...props }: IconButtonProps) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
        active && 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] hover:text-[var(--accent)]',
        className,
      )}
      {...props}
    />
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]',
          className,
        )}
        {...props}
      />
    )
  },
)

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]',
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[var(--faint)]">{hint}</span>}
    </label>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            className={cn('glass-panel max-h-[calc(100vh-48px)] w-[calc(100%-32px)] overflow-y-auto rounded-2xl border border-[var(--border)] p-5 shadow-soft', width)}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.16 }}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
                <IconButton label="Close" onClick={onClose}>
                  <X size={16} />
                </IconButton>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Divider() {
  return <div className="h-px w-full bg-[var(--border)]" />
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      {icon && <div className="text-[var(--faint)]">{icon}</div>}
      <div className="text-sm font-medium text-[var(--muted)]">{title}</div>
      {description && <div className="max-w-xs text-xs leading-relaxed text-[var(--faint)]">{description}</div>}
    </div>
  )
}
