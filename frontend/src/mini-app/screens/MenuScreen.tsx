import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { usePublishedMenu } from '../../features/menus/hooks/usePublishedMenu'
import { formatGregorianDate } from '../../features/menus/lib/menu-mapper'
import type { MenuDay } from '../../features/menus/model/menu-types'
import { orderApi } from '../../features/orders/api/orders-api'
import { currentDateTime, monthTitle } from '../../shared/lib/jalali'
import { isEmployeeDeadlineOpen, type MealDeadlineState } from '../../shared/lib/order-rules'
import { fa } from '../../shared/lib/persian-text'
import type { MealKind, Order } from '../../shared/types/domain'
import { useMiniAuth } from '../auth/MiniAuth'
import { KmButton, KmScreen, KmSkeleton, KmState } from '../ui/primitives'

function optionsOf(day: MenuDay, meal: MealKind) {
  return meal === 'lunch' ? day.lunch : day.dinner
}

export function MenuScreen({ toast }: { toast: (text: string) => void }) {
  const { user } = useMiniAuth()
  const today = currentDateTime()
  const published = usePublishedMenu(today.jy, today.jm)
  const [orders, setOrders] = useState<Order[]>([])
  const [deadlines, setDeadlines] = useState<Array<{ mealDate: string; mealType: 'LUNCH' | 'DINNER'; deadlineAt: string | null }>>([])
  const [sheet, setSheet] = useState<MealKind | null>(null)
  const [busy, setBusy] = useState(false)

  const day = useMemo(
    () => published.days.find((item) => item.jd === today.jd) ?? null,
    [published.days, today.jd],
  )

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      orderApi.listMine({ page: 1, pageSize: 100 }, controller.signal),
      orderApi.deadlines(today.jy, today.jm, controller.signal),
    ])
      .then(([listed, rows]) => {
        setOrders(listed.orders)
        setDeadlines(rows)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [today.jy, today.jm])

  function deadlineFor(meal: MealKind): MealDeadlineState {
    const mealDate = formatGregorianDate(today.jy, today.jm, today.jd)
    const row = deadlines.find((item) => item.mealDate === mealDate && item.mealType === (meal === 'lunch' ? 'LUNCH' : 'DINNER'))
    if (!row) return 'absent'
    if (!row.deadlineAt) return 'absent'
    return { at: row.deadlineAt }
  }

  async function choose(meal: MealKind, menuItemId: string | null) {
    if (!user) return
    const mealDate = formatGregorianDate(today.jy, today.jm, today.jd)
    const current = orders.find((item) => item.employeeId === user.id && item.jd === today.jd && item.jm === today.jm && item.jy === today.jy && item.meal === meal && item.cycleStatus !== 'CANCELLED')
    setBusy(true)
    try {
      let saved: Order
      if (menuItemId === null && current) saved = await orderApi.cancel(current.id)
      else if (current && menuItemId) saved = await orderApi.update(current.id, menuItemId)
      else if (menuItemId) {
        saved = await orderApi.create({
          mealDate,
          mealType: meal === 'lunch' ? 'LUNCH' : 'DINNER',
          menuItemId,
        })
      } else return
      setOrders((items) => [...items.filter((item) => item.id !== saved.id), saved])
      toast(menuItemId ? 'سفارش ذخیره شد' : 'سفارش لغو شد')
      setSheet(null)
    } catch (error) {
      toast(error instanceof AuthRequestError ? error.message : 'ذخیره سفارش انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KmScreen title="منوی امروز" subtitle={`${monthTitle(today)} ${fa(today.jd)}`}>
      {published.status === 'loading' ? <KmSkeleton lines={5} /> : null}
      {published.status === 'empty' ? <KmState title="منویی ذخیره نشده" body="منوی این ماه هنوز در سامانه نیست." /> : null}
      {published.status === 'unavailable' || published.status === 'error' ? (
        <KmState title="بارگذاری منو انجام نشد" body={published.message} action={<KmButton onClick={published.retry}>تلاش دوباره</KmButton>} />
      ) : null}
      {published.status === 'ready' && !day ? <KmState title="برای امروز غذایی نیست" body="روزهای دیگر را در سفارش‌های من یا پنل وب ببینید." /> : null}
      {day
        ? (['lunch', 'dinner'] as const).map((meal) => {
            const options = optionsOf(day, meal)
            if (!options?.length) return null
            const open = isEmployeeDeadlineOpen(deadlineFor(meal))
            const current = orders.find((item) => item.jy === today.jy && item.jm === today.jm && item.jd === today.jd && item.meal === meal && item.cycleStatus !== 'CANCELLED')
            return (
              <article key={meal} className="km-card">
                <div className="km-row">
                  <h2>{meal === 'lunch' ? 'ناهار' : 'شام'}</h2>
                  <span className={`km-chip ${open ? 'km-chip-ok' : 'km-chip-warn'}`}>{open ? 'باز' : 'مهلت گذشته'}</span>
                </div>
                <p>{current?.choice ?? options.map((item) => item.title).join('، ')}</p>
                <div className="km-actions" style={{ marginTop: 12 }}>
                  <KmButton disabled={!open || busy} onClick={() => setSheet(meal)}>
                    {current ? 'تغییر انتخاب' : 'ثبت سفارش'}
                  </KmButton>
                </div>
              </article>
            )
          })
        : null}
      {sheet && day ? (
        <div className="km-sheet" onClick={() => setSheet(null)}>
          <div className="km-sheet-card" role="dialog" aria-modal="true" aria-labelledby="km-meal-sheet-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="km-meal-sheet-title">انتخاب {sheet === 'lunch' ? 'ناهار' : 'شام'}</h2>
            {optionsOf(day, sheet)?.map((option) => (
              <button key={option.id} className="km-option" disabled={busy} onClick={() => void choose(sheet, option.id)}>
                {option.title}
              </button>
            ))}
            <KmButton variant="danger" disabled={busy} onClick={() => void choose(sheet, null)}>لغو سفارش</KmButton>
            <KmButton variant="ghost" onClick={() => setSheet(null)}>بستن</KmButton>
          </div>
        </div>
      ) : null}
    </KmScreen>
  )
}
