import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../lib/persian-text'
import { useApp } from '../../app/providers/app-store'

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
        'inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
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
  'h-11 min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink outline-none focus:border-primary'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableIn(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => {
    if ('disabled' in item && Boolean((item as HTMLButtonElement).disabled)) return false
    return item.getClientRects().length > 0
  })
}

function canRestore(element: HTMLElement) {
  if (!element.isConnected || element === document.body || element === document.documentElement) return false
  if (element.hasAttribute('disabled')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
}

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
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const lockedRef = useRef(locked)
  const onCloseRef = useRef(onClose)
  lockedRef.current = locked
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== panelRef.current && !panelRef.current?.contains(active)) {
      previouslyFocused.current = active
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (lockedRef.current) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = focusableIn(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      const inside = current instanceof Node && panel.contains(current)
      if (!inside) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && (current === first || current === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function onFocusIn(event: FocusEvent) {
      const panel = panelRef.current
      if (!panel?.isConnected) return
      if (event.target instanceof Node && panel.contains(event.target)) return
      panel.focus()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      document.body.style.overflow = previousOverflow
      const trigger = previouslyFocused.current
      previouslyFocused.current = null
      if (trigger && canRestore(trigger)) trigger.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-overlay" aria-hidden="true" onClick={locked ? undefined : onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative max-h-[92vh] w-full overflow-auto rounded-t-lg border border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-card outline-none sm:rounded-lg', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {!locked && (
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface2" onClick={onClose} aria-label="بستن">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function MonthBar({ icons }: { icons?: boolean }) {
  const app = useApp()
  if (!icons) {
    return (
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="min-h-11 rounded-md px-3 text-sm text-link" onClick={() => app.shiftMonth(-1)}>ماه قبل</button>
        <p className="min-w-0 truncate text-center text-sm font-semibold">{app.monthTitle}</p>
        <button type="button" className="min-h-11 rounded-md px-3 text-sm text-link" onClick={() => app.shiftMonth(1)}>ماه بعد</button>
      </div>
    )
  }
  return (
    <div className="inline-flex max-w-full items-center gap-0.5">
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-link hover:bg-surface2"
        aria-label="ماه قبل"
        title="ماه قبل"
        onClick={() => app.shiftMonth(-1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
      <p className="min-w-0 truncate px-1.5 text-center text-sm font-semibold">{app.monthTitle}</p>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-link hover:bg-surface2"
        aria-label="ماه بعد"
        title="ماه بعد"
        onClick={() => app.shiftMonth(1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
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
  size = 'compact',
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (value: T) => void
  label: string
  size?: 'compact' | 'touch'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-md border border-line bg-surface2 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(size === 'touch' ? 'min-h-11 px-3' : 'h-8 px-2.5', 'rounded text-sm', value === option.id ? 'bg-selected font-medium text-ink' : 'text-muted')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
