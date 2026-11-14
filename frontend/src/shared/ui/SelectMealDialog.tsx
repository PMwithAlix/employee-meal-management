import { useState } from 'react'
import { Button, Dialog } from './primitives'
import { fa, cn } from '../lib/persian-text'
import type { MealKind, MealOptionChoice } from '../types/domain'

export function SelectMealDialog({
  kind,
  jd,
  weekday,
  monthName,
  options,
  currentId,
  locked,
  ops,
  who,
  onClose,
  onSave,
}: {
  kind: MealKind
  jd: number
  weekday: string
  monthName: string
  options: MealOptionChoice[]
  currentId: string | null
  locked: boolean
  ops: boolean
  who?: string
  onClose: () => void
  onSave: (menuItemId: string | null) => boolean | Promise<boolean>
}) {
  const [draft, setDraft] = useState<string | null>(currentId)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const mealLabel = kind === 'lunch' ? 'ناهار' : 'شام'
  const other = kind === 'lunch' ? 'شام' : 'ناهار'
  const draftTitle = options.find((item) => item.id === draft)?.title ?? null
  const clearing = currentId !== null && draft === null
  const when = `${fa(jd)} ${monthName}، ${weekday}`

  function save() {
    if (saving || notice || draft === currentId) return
    setSaving(true)
    setFailed(false)
    void Promise.resolve(onSave(draft)).then((saved) => {
      setSaving(false)
      if (!saved) {
        setFailed(true)
        return
      }
      setNotice(clearing ? `${mealLabel} ${when} حذف شد. ${other} همین روز تغییر نکرد.` : `${mealLabel} ${when}: ${draftTitle}`)
      window.setTimeout(onClose, 900)
    }).catch(() => {
      setSaving(false)
      setFailed(true)
    })
  }

  return (
    <Dialog open title={`${currentId ? 'تغییر' : 'انتخاب'} ${mealLabel} — ${when}`} onClose={onClose} locked={saving || Boolean(notice)}>
      {who && <p className="text-sm font-medium">کارمند: {who}</p>}
      <p className={cn('text-sm text-muted', who && 'mt-1')}>این انتخاب فقط {mealLabel} است و روی {other} اثری ندارد. بستن پنجره سفارش را عوض نمی‌کند.</p>
      {locked && ops && (
        <p className="mt-2 rounded-md bg-warnbg px-3 py-2 text-sm text-warn">مهلت این وعده گذشته است. این تغییر به‌عنوان عملیات پشتیبانی ثبت می‌شود.</p>
      )}
      {locked && !ops && <p className="mt-2 rounded-md bg-warnbg px-3 py-2 text-sm text-warn">مهلت این وعده گذشته است.</p>}
      <fieldset className="mt-3 space-y-2" disabled={saving || Boolean(notice)}>
        <legend className="sr-only">{mealLabel}</legend>
        {options.map((option) => {
          const active = draft === option.id
          return (
            <label key={option.id} className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm', active ? 'border-primary bg-brandsubtle' : 'border-line bg-surface')}>
              <input type="radio" name={`meal-${jd}-${kind}`} className="h-5 w-5 shrink-0" checked={active} onChange={() => setDraft(option.id)} />
              <span className="min-w-0 flex-1 break-words">{option.title}</span>
              {option.id === currentId && <span className="shrink-0 text-xs text-muted">ثبت‌شده</span>}
            </label>
          )
        })}
        {currentId && (
          <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm', draft === null ? 'border-danger bg-dangerbg text-danger' : 'border-line')}>
            <input type="radio" name={`meal-${jd}-${kind}`} className="h-5 w-5 shrink-0" checked={draft === null} onChange={() => setDraft(null)} />
            <span>حذف انتخاب {mealLabel}</span>
          </label>
        )}
      </fieldset>
      {notice && <p className="mt-3 rounded-md bg-okbg px-3 py-2 text-sm text-ok" role="status">{notice}</p>}
      {failed && <p className="mt-3 rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">این تغییر ذخیره نشد. مهلت یا اجازه این وعده را دوباره بررسی کنید.</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="h-11 min-h-11" onClick={onClose} disabled={saving || Boolean(notice)}>انصراف</Button>
        <Button
          variant={clearing ? 'danger' : 'primary'}
          className="h-11 min-h-11"
          disabled={saving || Boolean(notice) || draft === currentId}
          onClick={save}
        >
          {saving ? 'در حال ذخیره' : notice ? 'ذخیره شد' : clearing ? 'تأیید حذف انتخاب' : currentId ? 'ثبت تغییر' : 'ثبت انتخاب'}
        </Button>
      </div>
    </Dialog>
  )
}
