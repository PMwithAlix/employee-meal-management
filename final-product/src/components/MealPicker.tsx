import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/text'
import type { MealKind, MealOptionChoice } from '../types'

export function MealPicker({
  open,
  trigger,
  kind,
  options,
  currentId,
  locked,
  ops,
  onClose,
  onSave,
}: {
  open: boolean
  trigger: HTMLElement | null
  kind: MealKind
  options: MealOptionChoice[]
  currentId: string | null
  locked: boolean
  ops: boolean
  onClose: () => void
  onSave: (menuItemId: string | null) => boolean | Promise<boolean>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef(`picker-${Math.random().toString(36).slice(2)}`)
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240, placeAbove: false })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const mealLabel = kind === 'lunch' ? 'ناهار' : 'شام'

  function cardEl() {
    if (!trigger) return null
    return trigger.tagName === 'BUTTON' ? trigger : (trigger.querySelector('button') ?? trigger)
  }

  function place() {
    const card = cardEl()
    if (!card) return
    const rect = card.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gutter = 8
    const width = Math.min(rect.width, Math.max(0, vw - gutter * 2))
    const rtl = document.documentElement.dir === 'rtl'
    let left = rtl ? rect.right - width : rect.left
    if (left + width > vw - gutter) left = vw - gutter - width
    if (left < gutter) left = gutter
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
    const card = cardEl()
    if (!card || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => place())
    observer.observe(card)
    return () => observer.disconnect()
  }, [open, trigger])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
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
    if (next === currentId) {
      onClose()
      return
    }
    setSaving(true)
    setFailed(false)
    void Promise.resolve(onSave(next)).then((saved) => {
      setSaving(false)
      if (saved) onClose()
      else setFailed(true)
    }).catch(() => {
      setSaving(false)
      setFailed(true)
    })
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
        const active = currentId === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={active}
            disabled={saving}
            onClick={() => pick(option.id)}
            className={cn(
              'flex min-h-11 w-full items-center gap-2 px-3 text-start text-sm',
              active ? 'bg-brandsubtle font-medium text-ink' : 'text-ink hover:bg-surface2',
              saving && 'opacity-60',
            )}
          >
            <span className="min-w-0 flex-1 break-words">{option.title}</span>
            {active && <span className="shrink-0 text-[11px] text-muted">ثبت‌شده</span>}
          </button>
        )
      })}
      {currentId && (
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
