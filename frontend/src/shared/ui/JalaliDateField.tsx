import { useMemo, useState } from 'react'
import { addMonths, currentDateTime, jalaliMonthLength, JALALI_MONTHS, PERSIAN_WEEKDAYS, weekdayIndex, type JalaliDate } from '../lib/jalali'
import { formatJalaliInput, isoDateFromJalali, jalaliFromIsoDate } from '../lib/jalali-picker'
import { fa } from '../lib/persian-text'
import { controlClass } from './primitives'

export function JalaliDateField({
  label,
  value,
  onChange,
  allowClear = true,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  allowClear?: boolean
}) {
  const selected = jalaliFromIsoDate(value)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<Pick<JalaliDate, 'jy' | 'jm'>>(() => selected ?? currentDateTime())
  const days = jalaliMonthLength(cursor.jy, cursor.jm)
  const startWeekday = weekdayIndex({ jy: cursor.jy, jm: cursor.jm, jd: 1 })
  const blanks = useMemo(() => Array.from({ length: startWeekday }), [startWeekday])

  return (
    <label className="relative text-xs text-muted">
      {label}
      <button
        type="button"
        className={`${controlClass} mt-1 bg-bg text-start text-sm text-ink`}
        onClick={() => {
          if (selected) setCursor({ jy: selected.jy, jm: selected.jm })
          setOpen((current) => !current)
        }}
      >
        {value ? fa(formatJalaliInput(value)) : 'انتخاب تاریخ شمسی'}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-line bg-surface p-3 shadow-card">
          <div className="mb-2 flex items-center justify-between text-sm text-ink">
            <button type="button" className="h-9 px-2" onClick={() => setCursor((month) => addMonths(month, -1))}>ماه قبل</button>
            <strong>{JALALI_MONTHS[cursor.jm - 1]} {fa(cursor.jy)}</strong>
            <button type="button" className="h-9 px-2" onClick={() => setCursor((month) => addMonths(month, 1))}>ماه بعد</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
            {PERSIAN_WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {blanks.map((_, index) => <span key={`b-${index}`} />)}
            {Array.from({ length: days }, (_, index) => {
              const jd = index + 1
              const iso = isoDateFromJalali({ jy: cursor.jy, jm: cursor.jm, jd })
              const active = value === iso
              return (
                <button
                  key={jd}
                  type="button"
                  className={`h-9 rounded text-sm ${active ? 'bg-primary text-onprimary' : 'text-ink hover:bg-surface2'}`}
                  onClick={() => {
                    if (!iso) return
                    onChange(iso)
                    setOpen(false)
                  }}
                >
                  {fa(jd)}
                </button>
              )
            })}
          </div>
          {allowClear && value && (
            <button type="button" className="mt-2 text-xs text-link" onClick={() => { onChange(''); setOpen(false) }}>
              پاک کردن تاریخ
            </button>
          )}
        </div>
      )}
    </label>
  )
}
