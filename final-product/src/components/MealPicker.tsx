import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/text'
import type { MealKind } from '../types'

export function MealPicker({
  open,
  trigger,
  kind,
  options,
  current,
  locked,
  ops,
  onClose,
  onSave,
}: {
  open: boolean
  trigger: HTMLElement | null
  kind: MealKind
  options: string[]
  current: string | null
  locked: boolean
  ops: boolean
  onClose: () => void
  onSave: (choice: string | null) => boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef(`picker-${Math.random().toString(36).slice(2)}`)
  const [box, setBox] = useState({ top: 0, left: 0, width: 240, maxHeight: 240, placeAbove: false })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const mealLabel = kind === 'lunch' ? 'ناهار' : 'شام'

  function place() {
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const mobile = vw < 768
    const width = mobile ? Math.min(vw - 16, Math.max(rect.width, vw - 16)) : Math.min(280, Math.max(rect.width, 200))
    let left = mobile ? 8 : rect.left
    if (left + width > vw - 8) left = Math.max(8, vw - 8 - width)
    if (left < 8) left = 8
    const spaceBelow = Math.max(80, vh - rect.bottom - 8)
    const spaceAbove = Math.max(80, rect.top - 8)
    const placeAbove = spaceBelow < 168 && spaceAbove > spaceBelow
    const maxHeight = Math.min(280, placeAbove ? spaceAbove : spaceBelow)
    const top = placeAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4
    setBox({ top, left, width, maxHeight, placeAbove })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, trigger])

  useEffect(() => {
    if (!open) return
    function onScroll() {
      place()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, trigger])

  useEffect(() => {
    if (!open) return
    const token = tokenRef.current
    function onOther(event: Event) {
      if ((event as CustomEvent<string>).detail !== token) onClose()
    }
    window.addEventListener('meal-picker-open', onOther)
    window.dispatchEvent(new CustomEvent('meal-picker-open', { detail: token }))
    return () => window.removeEventListener('meal-picker-open', onOther)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLButtonElement>('button[role="option"]')
    first?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panel?.contains(target) || trigger?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose, trigger])

  function pick(next: string | null) {
    if (saving) return
    if (next === current) {
      onClose()
      return
    }
    setSaving(true)
    setFailed(false)
    const saved = onSave(next)
    setSaving(false)
    if (saved) onClose()
    else setFailed(true)
  }

  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label={`انتخاب ${mealLabel}`}
      className="fixed z-50 overflow-auto rounded-md border border-line bg-surface py-1 shadow-card"
      style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
    >
      {locked && ops && (
        <p className="px-3 py-1.5 text-[11px] text-warn">مهلت گذشته است. این تغییر به‌عنوان عملیات پشتیبانی ثبت می‌شود.</p>
      )}
      {options.map((option) => {
        const active = current === option
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={active}
            disabled={saving}
            onClick={() => pick(option)}
            className={cn(
              'flex min-h-11 w-full items-center gap-2 px-3 text-start text-sm',
              active ? 'bg-brandsubtle font-medium text-ink' : 'text-ink hover:bg-surface2',
              saving && 'opacity-60',
            )}
          >
            <span className="min-w-0 flex-1 break-words">{option}</span>
            {active && <span className="shrink-0 text-[11px] text-muted">ثبت‌شده</span>}
          </button>
        )
      })}
      {current && (
        <button
          type="button"
          role="option"
          aria-selected={false}
          disabled={saving}
          onClick={() => pick(null)}
          className={cn('flex min-h-11 w-full items-center px-3 text-start text-sm text-danger hover:bg-dangerbg', saving && 'opacity-60')}
        >
          حذف انتخاب {mealLabel}
        </button>
      )}
      {failed && (
        <p className="px-3 py-1.5 text-[11px] text-danger" role="alert">ذخیره نشد. مهلت یا اجازه این وعده را بررسی کنید.</p>
      )}
    </div>,
    document.body,
  )
}
