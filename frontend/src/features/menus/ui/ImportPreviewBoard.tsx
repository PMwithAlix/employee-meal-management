import { useState } from 'react'
import { overlayMeals, localOption } from '../lib/menu-mapper'
import type { ImportPreview, MenuOption } from '../model/menu-types'
import { Button, Dialog } from '../../../shared/ui/primitives'
import { JALALI_MONTHS } from '../../../shared/lib/jalali'
import { fa } from '../../../shared/lib/persian-text'
import type { MealKind } from '../../../shared/types/domain'

export function ImportPreviewBoard({
  preview,
  disabled,
  onSaveMeal,
}: {
  preview: ImportPreview
  disabled: boolean
  onSaveMeal: (mealDate: string, meal: MealKind, options: MenuOption[]) => Promise<void>
}) {
  const days = overlayMeals(preview.jalaliYear, preview.jalaliMonth, preview.meals)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">پیش‌نمایش منوی {JALALI_MONTHS[preview.jalaliMonth - 1]} {fa(preview.jalaliYear)}</p>
      <p className="text-xs text-muted">قبل از تأیید، غذاها را همین‌جا اصلاح کنید. تا تأیید نهایی، منوی منتشرشده عوض نمی‌شود.</p>
      {days.map((day) => (
        <article key={day.jd} className="rounded-md border border-line bg-surface p-3">
          <p className="mb-2 text-sm font-medium">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]} · {day.weekday}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <PreviewMealEditor meal="lunch" options={day.lunch ?? []} disabled={disabled} onSave={(next) => onSaveMeal(day.mealDate, 'lunch', next)} />
            <PreviewMealEditor meal="dinner" options={day.dinner ?? []} disabled={disabled} onSave={(next) => onSaveMeal(day.mealDate, 'dinner', next)} />
          </div>
        </article>
      ))}
    </div>
  )
}

function PreviewMealEditor({
  meal,
  options,
  disabled,
  onSave,
}: {
  meal: MealKind
  options: MenuOption[]
  disabled: boolean
  onSave: (options: MenuOption[]) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [removing, setRemoving] = useState<MenuOption | null>(null)
  const label = meal === 'lunch' ? 'ناهار' : 'شام'
  return (
    <div>
      <p className={`mb-1 text-xs ${meal === 'lunch' ? 'text-lunch' : 'text-dinner'}`}>{label}</p>
      {options.length === 0 && <p className="text-xs text-muted">گزینه‌ای در فایل نیست</p>}
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option.id} className="min-h-11 rounded border border-line px-3 text-sm" disabled={disabled} onClick={() => setRemoving(option)}>
            {option.title} ×
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const name = value.trim()
          if (!name || disabled || options.some((item) => item.title === name) || options.length >= 3) return
          void onSave([...options, localOption(name, options.length + 1)]).then(() => setValue('')).catch(() => undefined)
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="غذای جدید" aria-label={`غذای جدید ${label}`} disabled={disabled} className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" />
        <Button type="submit" variant="secondary" disabled={disabled}>افزودن</Button>
      </form>
      <Dialog open={Boolean(removing)} title={`حذف از ${label}`} onClose={() => setRemoving(null)}>
        <p className="text-sm">«{removing?.title}» از پیش‌نمایش {label} این روز حذف شود؟</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>انصراف</Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => {
              if (!removing) return
              void onSave(options.filter((item) => item.id !== removing.id)).then(() => setRemoving(null)).catch(() => undefined)
            }}
          >
            حذف
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
