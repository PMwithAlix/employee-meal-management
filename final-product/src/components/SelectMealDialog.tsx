import { useState } from 'react'
import { Button, Dialog } from './ui'
import { fa } from '../lib/text'
import { cn } from '../lib/text'
import type { MealKind } from '../types'

export function SelectMealDialog({
  kind,
  jd,
  weekday,
  monthName,
  options,
  current,
  locked,
  ops,
  onClose,
  onSave,
}: {
  kind: MealKind
  jd: number
  weekday: string
  monthName: string
  options: string[]
  current: string | null
  locked: boolean
  ops: boolean
  onClose: () => void
  onSave: (choice: string | null) => void
}) {
  const [draft, setDraft] = useState<string | null>(current)
  const [saving, setSaving] = useState(false)
  const mealLabel = kind === 'lunch' ? 'ناهار' : 'شام'
  const other = kind === 'lunch' ? 'شام' : 'ناهار'

  return (
    <Dialog open title={`انتخاب ${mealLabel} — ${fa(jd)} ${monthName}، ${weekday}`} onClose={onClose} locked={saving}>
      <p className="text-sm text-muted">انتخاب {mealLabel} روی {other} اثری ندارد.</p>
      {locked && ops && (
        <p className="mt-2 rounded-md bg-warnbg px-3 py-2 text-sm text-warn">مهلت این وعده گذشته است. این تغییر به‌عنوان عملیات پشتیبانی ثبت می‌شود.</p>
      )}
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={mealLabel}>
        {options.map((option) => {
          const active = draft === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDraft(option)}
              className={cn('flex w-full items-center justify-between rounded-md border px-3 py-2 text-start text-sm', active ? 'border-primary bg-surface2' : 'border-line bg-surface')}
            >
              <span>{option}</span>
              <span className="text-xs text-muted">
                {option === current ? 'ثبت‌شده' : ''}
                {active ? ' انتخاب شده' : ''}
              </span>
            </button>
          )
        })}
        {current && (
          <button
            type="button"
            onClick={() => setDraft(null)}
            className={cn('w-full rounded-md border px-3 py-2 text-start text-sm', draft === null ? 'border-primary bg-surface2' : 'border-line')}
          >
            حذف انتخاب
          </button>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>انصراف</Button>
        <Button
          disabled={saving || draft === current}
          onClick={() => {
            setSaving(true)
            window.setTimeout(() => onSave(draft), 650)
          }}
        >
          {saving ? 'در حال ذخیره' : 'ثبت انتخاب'}
        </Button>
      </div>
    </Dialog>
  )
}
