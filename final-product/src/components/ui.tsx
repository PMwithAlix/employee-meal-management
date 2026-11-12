import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/text'

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-onprimary hover:bg-primaryhover active:bg-primaryactive',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface2',
        variant === 'ghost' && 'text-ink hover:bg-surface2',
        variant === 'danger' && 'bg-danger text-onprimary hover:opacity-90',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  )
}

export const controlClass =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary'

export function Dialog({
  open,
  title,
  onClose,
  children,
  wide,
  locked,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  locked?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button className="absolute inset-0 bg-overlay" aria-label="بستن" onClick={locked ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('relative max-h-[92vh] w-full overflow-auto rounded-t-lg border border-line bg-surface p-4 shadow-card sm:rounded-lg', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {!locked && (
            <button className="rounded-md p-1 text-muted hover:bg-surface2" onClick={onClose} aria-label="بستن">
              <X size={16} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs',
        tone === 'neutral' && 'bg-surface2 text-muted',
        tone === 'ok' && 'bg-okbg text-ok',
        tone === 'warn' && 'bg-warnbg text-warn',
        tone === 'danger' && 'bg-dangerbg text-danger',
        tone === 'info' && 'bg-infobg text-info',
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-line bg-surface2 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn('h-8 rounded px-2.5 text-sm', value === option.id ? 'bg-selected font-medium text-ink' : 'text-muted')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
