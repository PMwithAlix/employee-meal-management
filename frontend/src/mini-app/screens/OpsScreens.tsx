import { useEffect, useState } from 'react'
import { auditApi } from '../../features/audit/api/audit-api'
import { auditActionLabel } from '../../features/audit/lib/audit-copy'
import { AuthRequestError } from '../../features/auth/lib/auth-errors'
import { orderApi } from '../../features/orders/api/orders-api'
import type { BackendOrder } from '../../features/orders/model/order-types'
import { reportApi } from '../../features/reports/api/reports-api'
import type { DailyReport } from '../../features/reports/model/report-types'
import { userApi } from '../../features/users/api/users-api'
import type { ManagedUser } from '../../features/users/lib/user-mapper'
import { roleLabel } from '../../features/users/lib/user-mapper'
import { formatGregorianDate } from '../../features/menus/lib/menu-mapper'
import { currentDateTime } from '../../shared/lib/jalali'
import { fa } from '../../shared/lib/persian-text'
import { KmButton, KmScreen, KmSkeleton, KmState } from '../ui/primitives'

export function StaffScreen() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ManagedUser[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void userApi
      .list({ page: 1, pageSize: 20, username: query || undefined, isActive: true }, controller.signal)
      .then((payload) => {
        setItems(payload.items)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'فهرست کارکنان در دسترس نیست.')
      })
    return () => controller.abort()
  }, [query])

  return (
    <KmScreen title="کارکنان" subtitle="ایجاد، حذف و تغییر نقش در پنل وب انجام می‌شود.">
      <label className="km-field">
        <span>جست‌وجوی نام کاربری</span>
        <input type="search" aria-label="جست‌وجوی نام کاربری کارکنان" placeholder="نام کاربری را وارد کنید" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {!items && !error ? <KmSkeleton /> : null}
      {error ? <KmState title="دسترسی محدود" body={error} /> : null}
      {items?.length === 0 ? <KmState title="نتیجه‌ای نیست" body="با نام کاربری دقیق‌تر جست‌وجو کنید." /> : null}
      {items?.map((item) => (
        <article key={item.id} className="km-card">
          <div className="km-row">
            <h2>{item.username}</h2>
            <span className="km-chip">{roleLabel(item.role)}</span>
          </div>
          <p>{item.buildingName ?? 'بدون ساختمان'}{item.isActive ? '' : ' · غیرفعال'}</p>
        </article>
      ))}
    </KmScreen>
  )
}

export function OrgOrdersScreen() {
  const today = currentDateTime()
  const mealDate = formatGregorianDate(today.jy, today.jm, today.jd)
  const [username, setUsername] = useState('')
  const [items, setItems] = useState<BackendOrder[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void orderApi
      .listManaged({ page: 1, pageSize: 20, mealDate, username: username || undefined }, controller.signal)
      .then((payload) => {
        setItems(payload.items)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'سفارش‌های سازمان در دسترس نیست.')
      })
    return () => controller.abort()
  }, [mealDate, username])

  return (
    <KmScreen title="پیگیری سفارش" subtitle={`امروز · ${mealDate}`}>
      <label className="km-field">
        <span>نام کاربری</span>
        <input type="search" aria-label="جست‌وجوی سفارش بر اساس نام کاربری" placeholder="نام کاربری را وارد کنید" value={username} onChange={(event) => setUsername(event.target.value)} />
      </label>
      {!items && !error ? <KmSkeleton /> : null}
      {error ? <KmState title="بدون دسترسی" body={error} /> : null}
      {items?.length === 0 ? <KmState title="سفارشی نیست" body="برای این فیلتر سفارشی پیدا نشد." /> : null}
      {items?.map((item) => (
        <article key={item.id} className="km-card">
          <h2>{item.currentCycle?.optionTitle ?? '—'}</h2>
          <p>
            {item.currentCycle?.usernameSnapshot ?? item.userId} · {item.mealType === 'LUNCH' ? 'ناهار' : 'شام'} · {item.status === 'CANCELLED' ? 'لغو شده' : 'فعال'}
          </p>
        </article>
      ))}
    </KmScreen>
  )
}

export function ReportsScreen() {
  const today = currentDateTime()
  const mealDate = formatGregorianDate(today.jy, today.jm, today.jd)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void reportApi
      .daily(mealDate, 'ALL', controller.signal)
      .then((payload) => {
        setReport(payload)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'گزارش بارگذاری نشد.')
      })
    return () => controller.abort()
  }, [mealDate, retry])

  return (
    <KmScreen title="گزارش امروز" subtitle="همان گزارش روزانه پنل وب">
      {!report && !error ? <KmSkeleton lines={5} /> : null}
      {error ? <KmState title="گزارش در دسترس نیست" body={error} action={<KmButton onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</KmButton>} /> : null}
      {report ? [report.lunch, report.dinner].map((meal) => (
        <article key={meal.mealType} className="km-card">
          <h2>{meal.mealType === 'LUNCH' ? 'ناهار' : 'شام'}</h2>
          <p>جمع کارکنان {fa(meal.staffTotal)} · مهمان {fa(meal.guestTotal)}</p>
          {meal.foods.map((food) => (
            <p key={food.menuItemId}>{food.title} · {fa(food.total)}</p>
          ))}
        </article>
      )) : null}
    </KmScreen>
  )
}

export function ActivityScreen() {
  const [error, setError] = useState('')
  const [items, setItems] = useState<Array<{ id: string; action: string; createdAt: string; actorUsername: string | null }> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void auditApi
      .list({ page: 1, pageSize: 20 }, controller.signal)
      .then((payload) => {
        setItems(payload.items)
        setError('')
      })
      .catch((caught: unknown) => {
        setError(caught instanceof AuthRequestError ? caught.message : 'تاریخچه در دسترس نیست.')
      })
    return () => controller.abort()
  }, [])

  return (
    <KmScreen title="فعالیت‌ها" subtitle="فقط‌خواندنی">
      {!items && !error ? <KmSkeleton /> : null}
      {error ? <KmState title="بدون دسترسی" body={error} /> : null}
      {items?.length === 0 ? <KmState title="فعالیتی ثبت نشده" body="موردی برای نمایش وجود ندارد." /> : null}
      {items?.map((item) => (
        <article key={item.id} className="km-card">
          <h2>{auditActionLabel(item.action)}</h2>
          <p>{item.actorUsername ?? 'سامانه'} · {item.createdAt}</p>
        </article>
      ))}
    </KmScreen>
  )
}
