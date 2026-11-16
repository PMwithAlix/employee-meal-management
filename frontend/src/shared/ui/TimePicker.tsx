import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { CLOCK_PRESETS, clockMinutes, formatClock, parseClock } from '../lib/clock-time'
import { placeTimePopup } from '../lib/time-picker-position'
import { cn, fa } from '../lib/persian-text'
import { Button, controlClass } from './primitives'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function centerActive(list: HTMLDivElement | null) {
  const active = list?.querySelector<HTMLElement>('[data-active="true"]')
  if (!list || !active) return
  list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2
}

function fallbackParts(value: string) {
  return parseClock(value) ?? { hour: 12, minute: 0 }
}

export function TimePicker({
  label,
  value,
  onChange,
  disabled,
  ariaLabel,
  minuteStep = 5,
}: {
  label?: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  ariaLabel?: string
  minuteStep?: number
}) {
  const parsed = parseClock(value)
  const committed = fallbackParts(value)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(committed)
  const [box, setBox] = useState({ top: 0, left: 0, width: 288 })
  const root = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const hourList = useRef<HTMLDivElement>(null)
  const minuteList = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const minutes = clockMinutes(minuteStep, draft.minute)
  const display = parsed ? fa(formatClock(parsed.hour, parsed.minute) ?? value) : 'انتخاب ساعت'
  const draftClock = formatClock(draft.hour, draft.minute) ?? ''

  function close() {
    setOpen(false)
    setDraft(fallbackParts(value))
  }

  function confirm() {
    const next = formatClock(draft.hour, draft.minute)
    if (next && next !== value) onChange(next)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) setDraft(fallbackParts(value))
  }, [open, value])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const trigger = root.current?.querySelector('button')
      const panel = popup.current
      if (!trigger || !panel) return
      const next = placeTimePopup(
        trigger.getBoundingClientRect(),
        { width: 288, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      )
      setBox(next)
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, draft.hour, draft.minute])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) close()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, value])

  useEffect(() => {
    if (!open) return
    centerActive(hourList.current)
    centerActive(minuteList.current)
  }, [open, draft.hour, draft.minute])

  function nudge(part: 'hour' | 'minute', delta: number) {
    if (part === 'hour') {
      setDraft((current) => ({ ...current, hour: (current.hour + delta + 24) % 24 }))
      return
    }
    const index = minutes.indexOf(draft.minute)
    const fallback = index < 0 ? 0 : index
    const nextIndex = (fallback + delta + minutes.length) % minutes.length
    setDraft((current) => ({ ...current, minute: minutes[nextIndex] ?? current.minute }))
  }

  return (
    <div ref={root} className="relative">
      {label ? <span id={labelId} className="mb-1 block text-sm text-muted">{label}</span> : null}
      <button
        type="button"
        disabled={disabled}
        aria-labelledby={label ? labelId : undefined}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(controlClass, 'flex items-center justify-between gap-2 bg-bg text-start disabled:cursor-not-allowed disabled:opacity-50')}
        onClick={() => {
          if (disabled) return
          setOpen((current) => {
            if (current) {
              setDraft(fallbackParts(value))
              return false
            }
            setDraft(fallbackParts(value))
            return true
          })
        }}
      >
        <span className={cn('font-medium tracking-wide', parsed ? 'text-ink' : 'text-muted')} dir="ltr">{display}</span>
        <Clock size={16} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div
          ref={popup}
          role="dialog"
          aria-label="انتخاب ساعت"
          className="fixed z-40 max-h-[min(28rem,calc(100dvh-1rem))] overflow-auto rounded-md border border-line bg-surface p-3 shadow-[0_12px_40px_rgba(15,23,42,0.16)]"
          style={{ top: box.top, left: box.left, width: box.width }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">انتخاب ساعت</p>
            <span className="rounded-md bg-brandsubtle px-2 py-1 text-sm font-semibold text-ink" dir="ltr">{fa(draftClock)}</span>
          </div>
          <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-1">
            <div className="flex flex-col gap-1">
              <IconButton label="ساعت بعد" onClick={() => nudge('hour', 1)}><ChevronUp size={16} /></IconButton>
              <IconButton label="ساعت قبل" onClick={() => nudge('hour', -1)}><ChevronDown size={16} /></IconButton>
            </div>
            <Wheel label="ساعت" listRef={hourList}>
              {HOURS.map((hour) => (
                <WheelOption
                  key={hour}
                  active={draft.hour === hour}
                  onClick={() => setDraft((current) => ({ ...current, hour }))}
                >
                  {fa(String(hour).padStart(2, '0'))}
                </WheelOption>
              ))}
            </Wheel>
            <Wheel label="دقیقه" listRef={minuteList}>
              {minutes.map((minute) => (
                <WheelOption
                  key={minute}
                  active={draft.minute === minute}
                  onClick={() => setDraft((current) => ({ ...current, minute }))}
                >
                  {fa(String(minute).padStart(2, '0'))}
                </WheelOption>
              ))}
            </Wheel>
            <div className="flex flex-col gap-1">
              <IconButton label="دقیقه بعد" onClick={() => nudge('minute', 1)}><ChevronUp size={16} /></IconButton>
              <IconButton label="دقیقه قبل" onClick={() => nudge('minute', -1)}><ChevronDown size={16} /></IconButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {CLOCK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={cn('h-8 rounded-md border px-2 text-xs', draftClock === preset ? 'border-primary bg-brandsubtle text-ink' : 'border-line text-muted hover:bg-surface2')}
                onClick={() => {
                  const next = parseClock(preset)
                  if (next) setDraft(next)
                }}
              >
                {fa(preset)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>لغو</Button>
            <Button type="button" onClick={confirm}>تأیید</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Wheel({
  label,
  listRef,
  children,
}: {
  label: string
  listRef: RefObject<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <div>
      <p className="mb-1 text-center text-[11px] text-muted">{label}</p>
      <div ref={listRef} className="h-40 overflow-y-auto rounded-md border border-line bg-bg py-1">
        {children}
      </div>
    </div>
  )
}

function WheelOption({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-active={active ? 'true' : 'false'}
      className={cn('flex h-9 w-full items-center justify-center text-sm', active ? 'bg-primary text-onprimary' : 'text-ink hover:bg-surface2')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} className="grid h-9 w-9 place-items-center rounded-md border border-line text-muted hover:bg-surface2" onClick={onClick}>
      {children}
    </button>
  )
}
