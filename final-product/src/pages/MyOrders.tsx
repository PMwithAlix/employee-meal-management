import { useEffect, useState } from 'react'
import { Button, Dialog, Empty, MonthBar } from '../components/ui'
import { SelectMealDialog } from '../components/SelectMealDialog'
import { StaffOrdersPanel } from '../orders/StaffOrdersPanel'
import { usePublishedMenu } from '../menus/usePublishedMenu'
import { useApp } from '../store'
import { canGiveFeedback, findCancelledOrder, findOrder, isMealOpen, mealChoices, type MealDeadlineState } from '../lib/orders'
import type { MonthDeadlines } from '../lib/deadlines'
import { isSameDate, JALALI_MONTHS, type JalaliDateTime } from '../lib/jalali'
import { can } from '../permissions'
import { fa } from '../lib/text'
import { AuthRequestError } from '../auth/errors'
import { orderApi } from '../orders/client'
import type { DayMenu, MealKind, Order } from '../types'

export function MyOrdersPage() {
  const app = useApp()
  if (can(app.role, 'order.ops')) return <StaffOrdersPanel />
  return <EmployeeOrdersPage />
}

function EmployeeOrdersPage() {
  const app = useApp()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const id = app.role === 'admin' ? null : app.selfId
  const [editing, setEditing] = useState<Order | null>(null)
  const [picking, setPicking] = useState<{ day: DayMenu; meal: MealKind } | null>(null)
  if (!id) return <Empty title="سفارش شخصی ندارید" body="نقش ادمین به ساختمان و سفارش شخصی متصل نیست." />

  const days = [...published.pickerDays].reverse().filter((day) => day.lunch || day.dinner)
  const past = app.myOrders.filter((item) => item.employeeId === id && (item.jy !== app.selectedMonth.jy || item.jm !== app.selectedMonth.jm))
  const pickedDay = picking ? published.pickerDays.find((day) => day.jd === picking.day.jd && day.jm === picking.day.jm && day.jy === picking.day.jy) : undefined
  const pickedOptions = pickedDay && picking ? mealChoices(pickedDay, picking.meal) : null
  const pickedOrder = pickedDay && picking ? findOrder(app.myOrders, id, pickedDay, pickedDay.jd, picking.meal) : undefined

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <MonthBar />
          <p className="text-xs text-muted">سفارش‌های خودتان در این ماه. ناهار و شام جدا هستند و دیدگاه هر وعده فقط برای خودتان در این صفحه دیده می‌شود.</p>
        </header>
        {app.myOrdersStatus === 'loading' && <p className="px-4 py-3 text-sm text-muted">در حال خواندن سفارش‌های شما از سامانه…</p>}
        {app.myOrdersStatus === 'unavailable' && (
          <div className="px-4 py-3">
            <Empty title="سامانه در دسترس نیست" body={app.myOrdersMessage || 'سفارش‌های محلی جایگزین نمی‌شوند.'} />
            <Button className="mt-2" variant="secondary" onClick={app.retryMyOrders}>تلاش دوباره</Button>
          </div>
        )}
        {app.myOrdersStatus === 'error' && (
          <div className="px-4 py-3">
            <Empty title="بارگذاری سفارش انجام نشد" body={app.myOrdersMessage} />
            <Button className="mt-2" variant="secondary" onClick={app.retryMyOrders}>تلاش دوباره</Button>
          </div>
        )}
        {published.status === 'empty' && <div className="p-4"><Empty title="منوی منتشرشده‌ای برای این ماه نیست" body="تا انتشار منو، سفارشی ثبت نمی‌شود." /></div>}
        <div className="divide-y divide-line">
          {days.map((day) => {
            const lunch = findOrder(app.myOrders, id, day, day.jd, 'lunch')
            const dinner = findOrder(app.myOrders, id, day, day.jd, 'dinner')
            const lunchCancelled = lunch ? undefined : findCancelledOrder(app.myOrders, id, day, day.jd, 'lunch')
            const dinnerCancelled = dinner ? undefined : findCancelledOrder(app.myOrders, id, day, day.jd, 'dinner')
            return (
              <div key={day.jd} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_1fr]">
                <div>
                  <p className="text-sm font-medium">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}</p>
                  <p className="text-xs text-muted">{day.weekday}{isSameDate(day, app.now) ? ' · امروز' : ''}</p>
                </div>
                <OrderLine
                  label="ناهار"
                  name={day.lunch ? lunch?.choice ?? null : undefined}
                  missing={!day.lunch}
                  order={lunch}
                  note={lunchCancelled ? `${lunchCancelled.snapshotTitle ?? '—'} · لغو شده` : undefined}
                  status={day.lunch ? (isMealOpen(day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch')) ? 'مهلت باز' : 'مهلت تمام') : undefined}
                  canEdit={canChange(app.role, day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch'))}
                  canRate={app.mealServingsStatus === 'ready' && canGiveFeedback(lunch, app.now, app.mealServings)}
                  onEdit={() => setPicking({ day, meal: 'lunch' })}
                  onRate={() => lunch && setEditing(lunch)}
                />
                <OrderLine
                  label="شام"
                  name={day.dinner ? dinner?.choice ?? null : undefined}
                  missing={!day.dinner}
                  order={dinner}
                  note={dinnerCancelled ? `${dinnerCancelled.snapshotTitle ?? '—'} · لغو شده` : undefined}
                  status={day.dinner ? (isMealOpen(day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner')) ? 'مهلت باز' : 'مهلت تمام') : undefined}
                  canEdit={canChange(app.role, day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner'))}
                  canRate={app.mealServingsStatus === 'ready' && canGiveFeedback(dinner, app.now, app.mealServings)}
                  onEdit={() => setPicking({ day, meal: 'dinner' })}
                  onRate={() => dinner && setEditing(dinner)}
                />
              </div>
            )
          })}
        </div>
      </section>
      <section className="rounded-md border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">سفارش‌های قبلی</h2>
          <p className="text-xs text-muted">این فهرست جدا از ماه انتخاب‌شده است و نام غذا همان متن زمان ثبت است.</p>
        </header>
        {past.length === 0 ? (
          <div className="p-4"><Empty title="سفارش قبلی برای این حساب نیست" body="سفارش‌های ماه انتخاب‌شده در بخش بالا قرار دارند." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {past.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-words">{fa(item.jd)} {JALALI_MONTHS[item.jm - 1]} {fa(item.jy)} · {item.meal === 'lunch' ? 'ناهار' : 'شام'}</span>
                <span className="font-medium">{item.snapshotTitle ?? item.choice ?? '—'}</span>
                <span className="text-xs text-muted">{item.cycleStatus === 'CANCELLED' ? 'لغو شده' : 'ثبت‌شده'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing && <RatingDialog order={editing} onClose={() => setEditing(null)} />}
      {picking && pickedDay && pickedOptions && (
        <SelectMealDialog
          kind={picking.meal}
          jd={pickedDay.jd}
          weekday={pickedDay.weekday}
          monthName={JALALI_MONTHS[pickedDay.jm - 1]}
          options={pickedOptions}
          currentId={pickedOrder?.menuItemId ?? null}
          locked={!isMealOpen(pickedDay, picking.meal, app.deadlines, app.now, app.mealDeadlineAt(pickedDay, picking.meal))}
          ops={can(app.role, 'order.ops')}
          onClose={() => setPicking(null)}
          onSave={(menuItemId) => app.selectMeal(id, pickedDay.jd, picking.meal, null, 'self', menuItemId)}
        />
      )}
    </div>
  )
}

function canChange(role: Parameters<typeof can>[0], day: DayMenu, meal: MealKind, deadlines: MonthDeadlines, now: JalaliDateTime, deadlineAt?: MealDeadlineState) {
  if (!day[meal]) return false
  return isMealOpen(day, meal, deadlines, now, deadlineAt) ? can(role, 'order.self') : can(role, 'order.ops')
}

function OrderLine({
  label,
  name,
  missing,
  order,
  note,
  onRate,
  onEdit,
  status,
  canRate,
  canEdit,
}: {
  label: string
  name: string | null | undefined
  missing: boolean
  order?: Order
  note?: string
  onRate: () => void
  onEdit: () => void
  status?: string
  canRate: boolean
  canEdit: boolean
}) {
  const lunch = label === 'ناهار'
  return (
    <div className={lunch ? 'rounded-md border border-lunchline bg-lunchbg px-3 py-3' : 'rounded-md border border-dinnerline bg-dinnerbg px-3 py-3'}>
      <p className={lunch ? 'text-xs font-medium text-lunch' : 'text-xs font-medium text-dinner'}>{label}</p>
      <p className="mt-1 break-words text-sm">{missing ? 'منو تعریف نشده' : name ?? 'انتخاب نشده'}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {status && <p className="mt-1 text-xs text-muted">{status}</p>}
      {(canEdit || (canRate && name && order)) && (
        <div className="mt-2 flex flex-col gap-2">
          {canEdit && (
            <button type="button" className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm" onClick={onEdit}>
              {name ? `تغییر یا حذف ${label}` : `انتخاب ${label}`}
            </button>
          )}
          {canRate && name && order && (
            <button type="button" className="min-h-11 rounded-md px-3 text-start text-sm text-link" onClick={onRate}>
              {order.rating ? `ویرایش دیدگاه: ${fa(order.rating.score)} از ۵` : 'ثبت دیدگاه'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RatingDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const app = useApp()
  const [score, setScore] = useState(order.rating?.score ?? 0)
  const [comment, setComment] = useState(order.rating?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [failMessage, setFailMessage] = useState('دیدگاه ذخیره نشد. این وعده باید گذشته باشد و غذای انتخاب‌شده داشته باشد.')
  const [loadError, setLoadError] = useState('')
  const editing = Boolean(order.rating)
  const meal = order.meal === 'lunch' ? 'ناهار' : 'شام'
  useEffect(() => {
    const controller = new AbortController()
    void orderApi.getRating(order.id, controller.signal).then((rating) => {
      setScore(rating.score)
      setComment(rating.comment ?? '')
      app.syncOrderRating(order.id, { score: rating.score, comment: rating.comment ?? '' })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      if (error instanceof AuthRequestError && error.kind === 'not_found') return
      setLoadError(error instanceof AuthRequestError ? error.message : 'بارگذاری دیدگاه انجام نشد.')
    })
    return () => controller.abort()
  }, [order.id])
  return (
    <Dialog open title={`${editing ? 'ویرایش دیدگاه' : 'ثبت دیدگاه'} ${meal} ${fa(order.jd)} ${JALALI_MONTHS[order.jm - 1]}`} onClose={onClose} locked={saving || Boolean(notice)}>
      <p className="text-sm text-muted">امتیاز ۱ تا ۵. توضیح اختیاری است. در این صفحه فقط دیدگاه خودتان دیده می‌شود.</p>
      {order.choice && <p className="mt-2 text-sm">غذای ثبت‌شده: {order.choice}</p>}
      {loadError && <p className="mt-2 text-sm text-danger">{loadError}</p>}
      <fieldset className="mt-3" disabled={saving || Boolean(notice)}>
        <legend className="text-sm text-muted">امتیاز</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={`grid h-11 w-11 cursor-pointer place-items-center rounded-md border text-sm ${score === value ? 'border-primary bg-primary text-onprimary' : score > value ? 'border-primary bg-brandsubtle' : 'border-line'}`}>
              <input type="radio" className="sr-only" name={`rating-${order.id}`} checked={score === value} onChange={() => setScore(value)} />
              <span>{fa(value)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-muted">توضیح</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="توضیح، اگر لازم است" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base" />
      </label>
      {notice && <p className="mt-3 rounded-md bg-okbg px-3 py-2 text-sm text-ok" role="status">{notice}</p>}
      {failed && <p className="mt-3 rounded-md bg-dangerbg px-3 py-2 text-sm text-danger" role="alert">{failMessage}</p>}
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="h-11 min-h-11" onClick={onClose} disabled={saving || Boolean(notice)}>انصراف</Button>
        <Button
          className="h-11 min-h-11"
          disabled={!score || saving || Boolean(notice)}
          onClick={() => {
            setSaving(true)
            setFailed(false)
            void app.rateMeal(order.id, score, comment).then((result) => {
              setSaving(false)
              if (!result.ok) {
                setFailed(true)
                setFailMessage(result.message || 'دیدگاه ذخیره نشد.')
                return
              }
              setNotice(editing ? 'دیدگاه ویرایش شد.' : 'دیدگاه ثبت شد.')
              window.setTimeout(onClose, 900)
            })
          }}
        >
          {saving ? 'در حال ذخیره' : notice ? 'ذخیره شد' : editing ? 'ویرایش دیدگاه' : 'ثبت دیدگاه'}
        </Button>
      </div>
    </Dialog>
  )
}
