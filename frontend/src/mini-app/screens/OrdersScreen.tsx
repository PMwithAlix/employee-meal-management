import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { orderApi } from '../../features/orders/api/orders-api'
import { orderFoodName, orderMealLabel } from '../../features/orders/lib/my-orders'
import { currentDateTime, monthTitle } from '../../shared/lib/jalali'
import { fa } from '../../shared/lib/persian-text'
import type { Order } from '../../shared/types/domain'
import { splitOrdersByMealDate } from '../lib/orders-split'
import { KmButton, KmScreen, KmSkeleton, KmState } from '../ui/primitives'

export function OrdersScreen({ toast }: { toast: (text: string) => void }) {
  const today = currentDateTime()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void orderApi
      .listAllMine(controller.signal)
      .then((payload) => {
        setOrders(payload.orders)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'سفارش‌ها بارگذاری نشد.')
      })
    return () => controller.abort()
  }, [])

  const split = useMemo(() => splitOrdersByMealDate(orders ?? [], today), [orders, today])
  const visible = filter === 'upcoming' ? split.upcoming : split.past

  async function cancel(order: Order) {
    setBusyId(order.id)
    try {
      const saved = await orderApi.cancel(order.id)
      setOrders((items) => (items ?? []).map((item) => (item.id === saved.id ? saved : item)))
      toast('سفارش لغو شد')
    } catch (caught) {
      toast(caught instanceof AuthRequestError ? caught.message : 'لغو مجاز نبود.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <KmScreen title="سفارش‌های من" subtitle="دسته‌بندی بر اساس تاریخ واقعی وعده است، نه تاریخ ثبت.">
      <div className="km-filter-tabs" role="group" aria-label="فیلتر سفارش‌ها">
        <button type="button" className="km-filter-tab" aria-pressed={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>سفارش‌های پیش‌رو</button>
        <button type="button" className="km-filter-tab" aria-pressed={filter === 'past'} onClick={() => setFilter('past')}>سفارش‌های گذشته</button>
      </div>
      {!orders && !error ? <KmSkeleton lines={4} /> : null}
      {error ? <KmState title="خطا در دریافت سفارش‌ها" body={error} /> : null}
      {orders && visible.length === 0 ? (
        <KmState
          title={filter === 'upcoming' ? 'سفارش پیش‌رویی نیست' : 'سفارش گذشته‌ای نیست'}
          body="سفارش ثبت‌شده به‌خاطر نبود منوی جاری از تاریخچه حذف نمی‌شود."
        />
      ) : null}
      {visible.map((order) => (
        <article key={order.id} className="km-card">
          <div className="km-row">
            <h2>{orderFoodName(order)}</h2>
            <span className={`km-chip ${order.meal === 'lunch' ? 'km-chip-lunch' : 'km-chip-dinner'}`}>{orderMealLabel(order.meal)}</span>
          </div>
          <p>
            {monthTitle(order)} {fa(order.jd)}
            {order.cycleStatus === 'CANCELLED' ? ' · لغو شده' : ''}
          </p>
          {filter === 'upcoming' && order.cycleStatus !== 'CANCELLED' ? (
            <div className="km-actions" style={{ marginTop: 12 }}>
              <KmButton variant="danger" disabled={busyId === order.id} onClick={() => void cancel(order)}>
                لغو سفارش
              </KmButton>
            </div>
          ) : null}
        </article>
      ))}
    </KmScreen>
  )
}
