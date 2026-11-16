import { useEffect, useState } from 'react'
import { Badge, Button, Dialog, Empty } from '../shared/ui/primitives'
import { StaffOrdersPanel } from '../features/orders/ui/StaffOrdersPanel'
import { useApp } from '../app/providers/app-store'
import {
  feedbackEligibleOrders,
  orderFoodName,
  orderMealLabel,
  orderWeekday,
  paginateOrders,
} from '../features/orders/lib/my-orders'
import { canGiveFeedback } from '../shared/lib/order-rules'
import { isSameDate, JALALI_MONTHS } from '../shared/lib/jalali'
import { can } from '../shared/config/permissions'
import { cn, fa } from '../shared/lib/persian-text'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { orderApi } from '../features/orders/api/orders-api'
import type { Order } from '../shared/types/domain'

export function MyOrdersPage() {
  const app = useApp()
  if (can(app.role, 'order.self')) return <EmployeeOrdersPage />
  if (can(app.role, 'order.ops')) return <StaffOrdersPanel />
  return <Empty title="سفارش شخصی ندارید" body="برای این نقش سفارش شخصی تعریف نشده است." />
}

function EmployeeOrdersPage() {
  const app = useApp()
  const id = app.role === 'admin' ? null : app.selfId
  const [editing, setEditing] = useState<Order | null>(null)
  const [page, setPage] = useState(1)
  const ready = Boolean(id) && app.myOrdersStatus === 'ready' && app.mealServingsStatus === 'ready'
  const listed = id && ready ? feedbackEligibleOrders(app.myOrders, id, app.now, app.mealServings) : []
  const paged = paginateOrders(listed, page)
  useEffect(() => {
    if (page !== paged.page) setPage(paged.page)
  }, [page, paged.page])
  if (!id) return <Empty title="سفارش شخصی ندارید" body="نقش ادمین به ساختمان و سفارش شخصی متصل نیست." />

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">سفارش‌های من</h2>
          <p className="text-xs text-muted">در این بخش می‌توانید سفارش‌های دریافت‌شده خود را مشاهده کنید و درباره هر وعده نظر ثبت کنید.</p>
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
        {app.myOrdersStatus === 'ready' && app.mealServingsStatus === 'loading' && (
          <p className="px-4 py-3 text-sm text-muted">در حال خواندن ساعت سرو وعده برای تشخیص سفارش‌های قابل بازخورد…</p>
        )}
        {app.myOrdersStatus === 'ready' && (app.mealServingsStatus === 'unavailable' || app.mealServingsStatus === 'error') && (
          <div className="px-4 py-3">
            <Empty
              title="ساعت سرو وعده خوانده نشد"
              body={app.mealServingsMessage || 'بدون ساعت سرو نمی‌توان تشخیص داد کدام سفارش برای بازخورد آماده است. تاریخ سفارش به‌تنهایی ملاک قرار نمی‌گیرد.'}
            />
            <Button className="mt-2" variant="secondary" onClick={app.retryMealServings}>تلاش دوباره</Button>
          </div>
        )}
        {ready && listed.length === 0 && (
          <div className="p-4">
            <Empty
              title="سفارش دریافت‌شده‌ای نیست"
              body="این فهرست فقط سفارش فعال شما را نشان می‌دهد که زمان سرو آن گذشته باشد. انتخاب، تغییر و لغو غذا از منوی ماهانه انجام می‌شود."
            />
          </div>
        )}
        {ready && listed.length > 0 && (
          <>
            <ul className="divide-y divide-line">
              {paged.items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <ReceivedOrderCard
                    order={item}
                    today={isSameDate(item, app.now)}
                    canRate={can(app.role, 'order.rate') && canGiveFeedback(item, app.now, app.mealServings)}
                    onRate={() => setEditing(item)}
                  />
                </li>
              ))}
            </ul>
            {paged.pageCount > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
                <Button variant="secondary" disabled={paged.page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
                <span>{fa(paged.page)} / {fa(paged.pageCount)}</span>
                <Button variant="secondary" disabled={paged.page >= paged.pageCount} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
              </div>
            )}
          </>
        )}
      </section>
      {editing && <RatingDialog order={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ReceivedOrderCard({
  order,
  today,
  canRate,
  onRate,
}: {
  order: Order
  today: boolean
  canRate: boolean
  onRate: () => void
}) {
  const lunch = order.meal === 'lunch'
  const rated = Boolean(order.rating)
  return (
    <article className={cn('rounded-md border px-3 py-3', lunch ? 'border-lunchline bg-lunchbg' : 'border-dinnerline bg-dinnerbg')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {fa(order.jd)} {JALALI_MONTHS[order.jm - 1]} {fa(order.jy)}
          </p>
          <p className="text-xs text-muted">{orderWeekday(order)}{today ? ' · امروز' : ''}</p>
        </div>
        <p className={lunch ? 'text-xs font-medium text-lunch' : 'text-xs font-medium text-dinner'}>{orderMealLabel(order.meal)}</p>
      </div>
      <p className="mt-2 break-words text-sm">{orderFoodName(order)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={rated ? 'ok' : 'neutral'}>{rated ? 'بازخورد ثبت شده' : 'بازخورد ثبت نشده'}</Badge>
        {order.rating && (
          <p className="text-xs text-muted">
            امتیاز {fa(order.rating.score)} از ۵
            {order.rating.comment ? ` · ${order.rating.comment}` : ''}
          </p>
        )}
      </div>
      {canRate && (
        <button type="button" className="mt-2 min-h-11 rounded-md px-3 text-start text-sm text-link" onClick={onRate}>
          {rated ? 'مشاهده یا ویرایش نظر' : 'ثبت نظر'}
        </button>
      )}
    </article>
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
  const meal = orderMealLabel(order.meal)
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
      {(order.choice || order.snapshotTitle) && <p className="mt-2 text-sm">غذای ثبت‌شده: {orderFoodName(order)}</p>}
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
