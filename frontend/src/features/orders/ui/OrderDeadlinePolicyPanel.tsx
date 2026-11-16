import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { formatOrderDeadlineSentence, type DeadlineRelation, type MealDeadline } from '../../../shared/lib/deadlines'
import { parseClock } from '../../../shared/lib/clock-time'
import { Button, Field, controlClass } from '../../../shared/ui/primitives'
import { TimePicker } from '../../../shared/ui/TimePicker'
import { useApp } from '../../../app/providers/app-store'
import { orderApi } from '../api/orders-api'
import { rowsToDeadlinePolicies, type BackendDeadlinePolicy } from '../lib/order-mapper'
import type { MealKind } from '../../../shared/types/domain'

function emptyPolicy(meal: MealKind): MealDeadline {
  return { meal, relation: 'same_day', hour: 10, minute: 0 }
}

function samePolicy(left: MealDeadline, right: MealDeadline) {
  return left.relation === right.relation && left.hour === right.hour && left.minute === right.minute
}

function clockOf(value: MealDeadline) {
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
}

function toPayload(lunch: MealDeadline, dinner: MealDeadline): BackendDeadlinePolicy[] {
  return [
    { mealType: 'LUNCH', relation: lunch.relation === 'previous_day' ? 'PREVIOUS_DAY' : 'SAME_DAY', hour: lunch.hour, minute: lunch.minute },
    { mealType: 'DINNER', relation: dinner.relation === 'previous_day' ? 'PREVIOUS_DAY' : 'SAME_DAY', hour: dinner.hour, minute: dinner.minute },
  ]
}

export function OrderDeadlinePolicyPanel() {
  const app = useApp()
  const [lunch, setLunch] = useState<MealDeadline>(emptyPolicy('lunch'))
  const [dinner, setDinner] = useState<MealDeadline>(emptyPolicy('dinner'))
  const [savedLunch, setSavedLunch] = useState<MealDeadline>(emptyPolicy('lunch'))
  const [savedDinner, setSavedDinner] = useState<MealDeadline>(emptyPolicy('dinner'))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [boot, setBoot] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    setNotice('')
    void orderApi.deadlinePolicy(controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      const policies = rowsToDeadlinePolicies(rows)
      const nextLunch = policies.lunch ?? emptyPolicy('lunch')
      const nextDinner = policies.dinner ?? emptyPolicy('dinner')
      setLunch(nextLunch)
      setDinner(nextDinner)
      setSavedLunch(nextLunch)
      setSavedDinner(nextDinner)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری مهلت سفارش انجام نشد.')
    })
    return () => controller.abort()
  }, [boot])

  const dirty = !samePolicy(lunch, savedLunch) || !samePolicy(dinner, savedDinner)

  const lunchPreview = useMemo(() => formatOrderDeadlineSentence(lunch), [lunch])
  const dinnerPreview = useMemo(() => formatOrderDeadlineSentence(dinner), [dinner])

  async function save() {
    setBusy(true)
    setMessage('')
    setNotice('')
    try {
      const rows = await orderApi.replaceDeadlinePolicy(toPayload(lunch, dinner))
      const policies = rowsToDeadlinePolicies(rows)
      const nextLunch = policies.lunch ?? lunch
      const nextDinner = policies.dinner ?? dinner
      setLunch(nextLunch)
      setDinner(nextDinner)
      setSavedLunch(nextLunch)
      setSavedDinner(nextDinner)
      setNotice('مهلت ثبت سفارش ذخیره شد.')
      app.retryDeadlines()
    } catch (error: unknown) {
      setMessage(error instanceof AuthRequestError ? error.message : 'ذخیره مهلت سفارش انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">مهلت ثبت سفارش</h2>
      <p className="mt-1 text-xs text-muted">این سیاست برای همه ماه‌ها و روزها اعمال می‌شود. ساعت سرو غذا جدا است و با این مهلت عوض نمی‌شود.</p>
      {status === 'loading' && <p className="mt-3 text-sm text-muted">در حال خواندن مهلت سفارش…</p>}
      {status === 'error' && (
        <div className="mt-3">
          <p className="text-sm text-danger">{message}</p>
          <Button className="mt-2" variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      )}
      {status === 'ready' && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <PolicyCard meal="lunch" value={lunch} preview={lunchPreview} disabled={busy} onChange={setLunch} />
            <PolicyCard meal="dinner" value={dinner} preview={dinnerPreview} disabled={busy} onChange={setDinner} />
          </div>
          {dirty && <p className="text-xs text-muted">تغییرات ذخیره‌نشده دارند.</p>}
          {message && <p className="text-sm text-danger">{message}</p>}
          {notice && <p className="text-sm text-ok" role="status">{notice}</p>}
          <Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'در حال ذخیره' : 'ذخیره مهلت سفارش'}</Button>
        </div>
      )}
    </section>
  )
}

function PolicyCard({
  meal,
  value,
  preview,
  disabled,
  onChange,
}: {
  meal: MealKind
  value: MealDeadline
  preview: string
  disabled: boolean
  onChange: (next: MealDeadline) => void
}) {
  return (
    <article className="rounded-md border border-line bg-surface2 p-3">
      <h3 className="text-sm font-medium">{meal === 'lunch' ? 'ناهار' : 'شام'}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="نسبت به روز وعده">
          <select
            className={controlClass}
            disabled={disabled}
            value={value.relation}
            onChange={(event) => onChange({ ...value, relation: event.target.value as DeadlineRelation })}
          >
            <option value="same_day">همان روز</option>
            <option value="previous_day">روز قبل</option>
          </select>
        </Field>
        <TimePicker
          label="ساعت"
          value={clockOf(value)}
          disabled={disabled}
          ariaLabel={meal === 'lunch' ? 'ساعت مهلت ناهار' : 'ساعت مهلت شام'}
          onChange={(clock) => {
            const parsed = parseClock(clock)
            if (!parsed) return
            onChange({ ...value, hour: parsed.hour, minute: parsed.minute })
          }}
        />
      </div>
      <p className="mt-3 text-sm">{preview}</p>
    </article>
  )
}
