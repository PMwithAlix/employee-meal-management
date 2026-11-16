import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/persian-text'
import { pickerViewBounds, placeMealPicker, samePickerBox, type MealPickerBox } from '../lib/meal-picker-position'
import type { MealKind, MealOptionChoice } from '../types/domain'

const emptyBox: MealPickerBox = { top: 0, left: 0, width: 0, maxHeight: 80, placeAbove: false }

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
  const [box, setBox] = useState<MealPickerBox>(emptyBox)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const mealLabel = kind === 'lunch' ? 'ناهار' : 'شام'

  function cardEl() {
    if (!trigger) return null
    return trigger.tagName === 'BUTTON' ? trigger : (trigger.querySelector('button') ?? trigger)
  }

  function visibleRect(element: Element | null) {
    if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return null
    return element.getBoundingClientRect()
  }

  function place() {
    const card = cardEl()
    const panel = panelRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const vv = window.visualViewport
    const header = visibleRect(document.querySelector('header.sticky'))
    const nav = visibleRect(document.querySelector('nav[aria-label="ناوبری اصلی"]'))
    const view = pickerViewBounds(
      vv
        ? { offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft, width: vv.width, height: vv.height }
        : { offsetTop: 0, offsetLeft: 0, width: window.innerWidth, height: window.innerHeight },
      {
        headerBottom: header ? header.bottom : null,
        navTop: nav && nav.height > 0 ? nav.top : null,
      },
    )
    const next = placeMealPicker(
      { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width },
      panel ? panel.scrollHeight : 0,
      view,
      document.documentElement.dir !== 'ltr',
    )
    setBox((current) => (samePickerBox(current, next) ? current : next))
  }

  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    function schedule() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        place()
      })
    }
    place()
    const card = cardEl()
    const panel = panelRef.current
    const observers: ResizeObserver[] = []
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule)
      if (card) observer.observe(card)
      if (panel) observer.observe(panel)
      observers.push(observer)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observers.forEach((observer) => observer.disconnect())
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
    }
  }, [open, trigger, options.length, currentId, locked, ops, failed, saving])

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
