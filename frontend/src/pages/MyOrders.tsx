import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Empty, MonthBar } from '../shared/ui/primitives'
import { MealPicker } from '../shared/ui/MealPicker'
import { StaffOrdersPanel } from '../features/orders/ui/StaffOrdersPanel'
import { usePublishedMenu } from '../features/menus/hooks/usePublishedMenu'
import { useApp } from '../app/providers/app-store'
import { daysForMyOrders, mealDisplayName, partitionMyOrders } from '../features/orders/lib/my-orders'
import { canGiveFeedback, findCancelledOrder, findOrder, isMealOpen, mealChoices, type MealDeadlineState } from '../shared/lib/order-rules'
import type { MonthDeadlines } from '../shared/lib/deadlines'
import { isSameDate, JALALI_MONTHS, type JalaliDateTime } from '../shared/lib/jalali'
import { can } from '../shared/config/permissions'
import { fa } from '../shared/lib/persian-text'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { orderApi } from '../features/orders/api/orders-api'
import type { DayMenu, MealKind, MealOptionChoice, Order } from '../shared/types/domain'

export function MyOrdersPage() {
  const app = useApp()
  if (can(app.role, 'order.self')) return <EmployeeOrdersPage />
  if (can(app.role, 'order.ops')) return <StaffOrdersPanel />
  return <Empty title="سفارش شخصی ندارید" body="برای این نقش سفارش شخصی تعریف نشده است." />
}

function EmployeeOrdersPage() {
  const app = useApp()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const id = app.role === 'admin' ? null : app.selfId
  const [editing, setEditing] = useState<Order | null>(null)
  if (!id) return <Empty title="سفارش شخصی ندارید" body="نقش ادمین به ساختمان و سفارش شخصی متصل نیست." />

  const split = partitionMyOrders(app.myOrders, id, app.selectedMonth)
  const days = daysForMyOrders(published.pickerDays, split.current, app.selectedMonth)

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
        {published.status === 'empty' && days.length === 0 && (
          <div className="p-4"><Empty title="منویی برای این ماه نیست" body="سفارش ثبت‌شده‌ای هم برای این ماه پیدا نشد." /></div>
        )}
        <div className="divide-y divide-line">
          {days.map((day) => {
            const lunch = findOrder(app.myOrders, id, day, day.jd, 'lunch')
            const dinner = findOrder(app.myOrders, id, day, day.jd, 'dinner')
            const lunchCancelled = lunch ? undefined : findCancelledOrder(app.myOrders, id, day, day.jd, 'lunch')
            const dinnerCancelled = dinner ? undefined : findCancelledOrder(app.myOrders, id, day, day.jd, 'dinner')
            const lunchView = mealDisplayName(Boolean(day.lunch), lunch, lunchCancelled)
            const dinnerView = mealDisplayName(Boolean(day.dinner), dinner, dinnerCancelled)
            return (
              <div key={`${day.jy}-${day.jm}-${day.jd}`} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_1fr]">
                <div>
                  <p className="text-sm font-medium">{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}</p>
                  <p className="text-xs text-muted">{day.weekday}{isSameDate(day, app.now) ? ' · امروز' : ''}</p>
                </div>
                <OrderLine
                  meal="lunch"
                  name={lunchView.name}
                  missing={lunchView.missing}
                  order={lunch}
                  note={lunchCancelled ? `${lunchCancelled.snapshotTitle ?? '—'} · لغو شده` : undefined}
                  status={day.lunch ? (isMealOpen(day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch')) ? 'مهلت باز' : 'مهلت تمام') : undefined}
                  canEdit={canChange(app.role, day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch'))}
                  canRate={app.mealServingsStatus === 'ready' && canGiveFeedback(lunch, app.now, app.mealServings)}
                  options={mealChoices(day, 'lunch')}
                  currentId={lunch?.menuItemId ?? null}
                  locked={!isMealOpen(day, 'lunch', app.deadlines, app.now, app.mealDeadlineAt(day, 'lunch'))}
                  ops={can(app.role, 'order.ops')}
                  onSave={(menuItemId) => app.selectMeal(id, day.jd, 'lunch', null, 'self', menuItemId)}
                  onRate={() => lunch && setEditing(lunch)}
                />
                <OrderLine
                  meal="dinner"
                  name={dinnerView.name}
                  missing={dinnerView.missing}
                  order={dinner}
                  note={dinnerCancelled ? `${dinnerCancelled.snapshotTitle ?? '—'} · لغو شده` : undefined}
                  status={day.dinner ? (isMealOpen(day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner')) ? 'مهلت باز' : 'مهلت تمام') : undefined}
                  canEdit={canChange(app.role, day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner'))}
                  canRate={app.mealServingsStatus === 'ready' && canGiveFeedback(dinner, app.now, app.mealServings)}
                  options={mealChoices(day, 'dinner')}
                  currentId={dinner?.menuItemId ?? null}
                  locked={!isMealOpen(day, 'dinner', app.deadlines, app.now, app.mealDeadlineAt(day, 'dinner'))}
                  ops={can(app.role, 'order.ops')}
                  onSave={(menuItemId) => app.selectMeal(id, day.jd, 'dinner', null, 'self', menuItemId)}
                  onRate={() => dinner && setEditing(dinner)}
                />
              </div>
            )
          })}
        </div>
      </section>
      {(app.myOrdersStatus === 'ready' || app.myOrders.length > 0) && (
        <>
          <HistorySection
            title="سفارش‌های آینده"
            emptyTitle="سفارش آینده‌ای نسبت به این ماه نیست"
            emptyBody="سفارش‌هایی که بعد از پایان این ماه هستند اینجا می‌آیند."
            hint="این سفارش‌ها بعد از ماه انتخاب‌شده هستند و نام غذا همان متن زمان ثبت است."
            items={split.future}
          />
          <HistorySection
            title="سفارش‌های گذشته"
            emptyTitle="سفارش گذشته‌ای نسبت به این ماه نیست"
            emptyBody="سفارش‌های ماه انتخاب‌شده در بخش بالا قرار دارند."
            hint="این سفارش‌ها پیش از شروع ماه انتخاب‌شده هستند و نام غذا همان متن زمان ثبت است."
            items={split.past}
          />
          {split.invalid.length > 0 && (
            <HistorySection
              title="سفارش با تاریخ نامعتبر"
              emptyTitle=""
              emptyBody=""
              hint="این سفارش‌ها حذف نشدند، اما به هیچ ماهی نسبت داده نشدند چون تاریخ وعده معتبر نبود."
              items={split.invalid}
            />
          )}
        </>
      )}
      {editing && <RatingDialog order={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function HistorySection({
  title,
  hint,
  emptyTitle,
  emptyBody,
  items,
}: {
  title: string
  hint: string
  emptyTitle: string
  emptyBody: string
  items: Order[]
}) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted">{hint}</p>
      </header>
      {items.length === 0 ? (
        emptyTitle ? <div className="p-4"><Empty title={emptyTitle} body={emptyBody} /></div> : null
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words">
                {item.jy && item.jm && item.jd ? `${fa(item.jd)} ${JALALI_MONTHS[item.jm - 1] ?? ''} ${fa(item.jy)}` : 'تاریخ نامعتبر'}
                {' · '}
                {item.meal === 'lunch' ? 'ناهار' : 'شام'}
              </span>
              <span className="font-medium">{item.snapshotTitle ?? item.choice ?? '—'}</span>
              <span className="text-xs text-muted">{item.cycleStatus === 'CANCELLED' ? 'لغو شده' : 'ثبت‌شده'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function canChange(role: Parameters<typeof can>[0], day: DayMenu, meal: MealKind, deadlines: MonthDeadlines, now: JalaliDateTime, deadlineAt?: MealDeadlineState) {
  if (!day[meal]) return false
  return isMealOpen(day, meal, deadlines, now, deadlineAt) ? can(role, 'order.self') : can(role, 'order.ops')
}

function OrderLine({
  meal,
  name,
  missing,
  order,
  note,
  onRate,
  status,
  canRate,
  canEdit,
  options,
  currentId,
  locked,
  ops,
  onSave,
}: {
  meal: MealKind
  name: string | null | undefined
  missing: boolean
  order?: Order
  note?: string
  onRate: () => void
  status?: string
  canRate: boolean
  canEdit: boolean
  options: MealOptionChoice[] | null
  currentId: string | null
  locked: boolean
  ops: boolean
  onSave: (menuItemId: string | null) => boolean | Promise<boolean>
}) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const lunch = meal === 'lunch'
  const label = lunch ? 'ناهار' : 'شام'
  const busy = Boolean(app.orderingKey)
  return (
    <div ref={triggerRef} className={lunch ? 'rounded-md border border-lunchline bg-lunchbg px-3 py-3' : 'rounded-md border border-dinnerline bg-dinnerbg px-3 py-3'}>
      <p className={lunch ? 'text-xs font-medium text-lunch' : 'text-xs font-medium text-dinner'}>{label}</p>
      <p className="mt-1 break-words text-sm">{missing ? 'منو تعریف نشده' : name ?? 'انتخاب نشده'}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {status && <p className="mt-1 text-xs text-muted">{status}</p>}
      {(canEdit || (canRate && name && order)) && (
        <div className="mt-2 flex flex-col gap-2">
          {canEdit && (
            <button
              type="button"
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm"
              aria-haspopup="listbox"
              aria-expanded={open}
              disabled={busy}
              onClick={() => setOpen((value) => !value)}
            >
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
      {canEdit && options && (
        <MealPicker
          open={open}
          trigger={triggerRef.current}
          kind={meal}
          options={options}
          currentId={currentId}
          locked={locked}
          ops={ops}
          onClose={() => setOpen(false)}
          onSave={onSave}
        />
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
