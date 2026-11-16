import { useEffect, useMemo, useState } from 'react'
import { Button, Field, controlClass } from '../../../shared/ui/primitives'
import { TimePicker } from '../../../shared/ui/TimePicker'
import { parseClock } from '../../../shared/lib/clock-time'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { deadlineAtFromPattern, formatDeadline, inferMealDeadline, type DeadlineRelation, type MealDeadline } from '../../../shared/lib/deadlines'
import { usePublishedMenu } from '../../menus/hooks/usePublishedMenu'
import { useApp } from '../../../app/providers/app-store'
import type { MealKind } from '../../../shared/types/domain'
import { orderApi } from '../api/orders-api'
import { toDeadlineMap } from '../lib/order-mapper'

function emptyDeadline(meal: MealKind): MealDeadline {
  return { meal, relation: 'same_day', hour: 10, minute: 0 }
}

export function DeadlineEditor() {
  const app = useApp()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const [lunch, setLunch] = useState<MealDeadline>(emptyDeadline('lunch'))
  const [dinner, setDinner] = useState<MealDeadline>(emptyDeadline('dinner'))
  const [defined, setDefined] = useState({ lunch: false, dinner: false })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [boot, setBoot] = useState(0)

  const lunchDates = useMemo(() => published.pickerDays.filter((day) => day.lunch).map((day) => day.gregorianDate).filter((value): value is string => Boolean(value)), [published.pickerDays])
  const dinnerDates = useMemo(() => published.pickerDays.filter((day) => day.dinner).map((day) => day.gregorianDate).filter((value): value is string => Boolean(value)), [published.pickerDays])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    setNotice('')
    void orderApi.deadlines(app.selectedMonth.jy, app.selectedMonth.jm, controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      const map = toDeadlineMap(rows)
      const lunchValue = inferMealDeadline(map, 'lunch', lunchDates)
      const dinnerValue = inferMealDeadline(map, 'dinner', dinnerDates)
      setLunch(lunchValue ?? emptyDeadline('lunch'))
      setDinner(dinnerValue ?? emptyDeadline('dinner'))
      setDefined({ lunch: Boolean(lunchValue), dinner: Boolean(dinnerValue) })
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDefined({ lunch: false, dinner: false })
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری مهلت سفارش انجام نشد.')
    })
    return () => controller.abort()
  }, [app.selectedMonth.jy, app.selectedMonth.jm, boot, lunchDates.join(','), dinnerDates.join(',')])

  async function save() {
    const items = [
      ...lunchDates.map((mealDate) => ({ mealDate, mealType: 'LUNCH' as const, deadlineAt: deadlineAtFromPattern(mealDate, lunch) })),
      ...dinnerDates.map((mealDate) => ({ mealDate, mealType: 'DINNER' as const, deadlineAt: deadlineAtFromPattern(mealDate, dinner) })),
    ]
    if (items.length === 0) {
      setMessage('برای روزهای دارای وعده باید منوی منتشرشده موجود باشد.')
      return
    }
    setBusy(true)
    setMessage('')
    setNotice('')
    try {
      await orderApi.replaceDeadlines(app.selectedMonth.jy, app.selectedMonth.jm, items)
      setNotice('مهلت سفارش ذخیره شد')
      setDefined({ lunch: lunchDates.length > 0, dinner: dinnerDates.length > 0 })
      app.retryDeadlines()
      setBoot((value) => value + 1)
    } catch (error: unknown) {
      setMessage(error instanceof AuthRequestError ? error.message : 'ذخیره مهلت انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <MealFields meal="lunch" value={lunch} defined={defined.lunch} disabled={status !== 'ready' || busy} onChange={setLunch} />
        <MealFields meal="dinner" value={dinner} defined={defined.dinner} disabled={status !== 'ready' || busy} onChange={setDinner} />
        <Button disabled={busy || status !== 'ready'} onClick={() => void save()}>{busy ? 'در حال ذخیره...' : 'ذخیره مهلت‌ها'}</Button>
      </div>
      {status === 'loading' && <p className="text-xs text-muted">در حال خواندن مهلت‌های ذخیره‌شده…</p>}
      {status === 'error' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-danger">{message}</p>
          <Button variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      )}
      {status === 'ready' && !defined.lunch && !defined.dinner && <p className="text-xs text-muted">مهلتی برای این ماه ذخیره نشده است.</p>}
      {message && status === 'ready' && <p className="text-xs text-danger">{message}</p>}
      {notice && <p className="text-xs text-ok" role="status">{notice}</p>}
    </div>
  )
}

function MealFields({ meal, value, defined, disabled, onChange }: { meal: MealKind; value: MealDeadline; defined: boolean; disabled: boolean; onChange: (next: MealDeadline) => void }) {
  const time = `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={meal === 'lunch' ? 'مهلت ناهار' : 'مهلت شام'}>
        <select className={controlClass} disabled={disabled} value={value.relation} onChange={(event) => onChange({ ...value, relation: event.target.value as DeadlineRelation })}>
          <option value="same_day">همان روز</option>
          <option value="previous_day">روز قبل</option>
        </select>
      </Field>
      <div className="min-w-[12rem]">
        <TimePicker
          label="ساعت"
          value={time}
          disabled={disabled}
          ariaLabel={meal === 'lunch' ? 'ساعت مهلت ناهار' : 'ساعت مهلت شام'}
          onChange={(clock) => {
            const parsed = parseClock(clock)
            if (!parsed) return
            onChange({ ...value, hour: parsed.hour, minute: parsed.minute })
          }}
        />
      </div>
      <p className="pb-2 text-xs text-muted">{defined ? formatDeadline(value) : 'ذخیره نشده'}</p>
    </div>
  )
}
