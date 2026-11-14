import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../../../shared/ui/primitives'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { buildingApi, type BuildingSummary } from '../../buildings/api/buildings-api'
import { formatGregorianDate } from '../../menus/lib/menu-mapper'
import { usePublishedMenu } from '../../menus/hooks/usePublishedMenu'
import { fa } from '../../../shared/lib/persian-text'
import { jalaliMonthLength, JALALI_MONTHS } from '../../../shared/lib/jalali'
import { useApp } from '../../../app/providers/app-store'
import { userApi, type DirectoryUser } from '../../users/api/users-api'
import { orderApi } from '../api/orders-api'
import type { BackendOrder, OrderCycleStatus } from '../model/order-types'

function mealLabel(type: 'LUNCH' | 'DINNER') {
  return type === 'DINNER' ? 'شام' : 'ناهار'
}

function snapshot(value: string | null | undefined) {
  return value && value.trim() ? value : '—'
}

export function StaffOrdersPanel() {
  const app = useApp()
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const from = formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, 1)
  const to = formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, jalaliMonthLength(app.selectedMonth.jy, app.selectedMonth.jm))
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [dateFilter, setDateFilter] = useState('')
  const [mealFilter, setMealFilter] = useState<'' | 'LUNCH' | 'DINNER'>('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | OrderCycleStatus>('')
  const [username, setUsername] = useState('')
  const [page, setPage] = useState(1)
  const [boot, setBoot] = useState(0)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
  const [listMessage, setListMessage] = useState('')
  const [items, setItems] = useState<BackendOrder[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const [userId, setUserId] = useState('')
  const [jd, setJd] = useState(1)
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('lunch')
  const [menuItemId, setMenuItemId] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState<BackendOrder | null>(null)
  const [cancelling, setCancelling] = useState<BackendOrder | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      buildingApi.list(controller.signal),
      userApi.listAll({ role: 'EMPLOYEE', isActive: true }, controller.signal),
    ]).then(([listedBuildings, listedUsers]) => {
      if (controller.signal.aborted) return
      setBuildings(listedBuildings)
      setUsers(listedUsers.items)
      setUserId((current) => current || listedUsers.items[0]?.id || '')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setFormError(error instanceof AuthRequestError ? error.message : 'بارگذاری کارکنان انجام نشد.')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setListStatus('loading')
    setListMessage('')
    void orderApi.listManaged({
      page,
      pageSize,
      from: dateFilter ? undefined : from,
      to: dateFilter ? undefined : to,
      mealDate: dateFilter || undefined,
      mealType: mealFilter || undefined,
      buildingId: buildingFilter || undefined,
      status: statusFilter || undefined,
      username: username.trim() || undefined,
    }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listed.total) || listed.page !== page || listed.pageSize !== pageSize) {
        setItems([])
        setListStatus('error')
        setListMessage('بارگذاری سفارش‌های سازمان کامل نشد.')
        return
      }
      setItems(listed.items)
      setTotal(listed.total)
      setListStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
      if (error instanceof AuthRequestError && (error.kind === 'forbidden' || error.status === 403)) {
        setListStatus('forbidden')
        setListMessage(error.message)
        return
      }
      setListStatus('error')
      setListMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری سفارش‌ها انجام نشد.')
    })
    return () => controller.abort()
  }, [page, pageSize, from, to, dateFilter, mealFilter, buildingFilter, statusFilter, username, boot])

  const pickerDay = published.pickerDays.find((day) => day.jd === jd)
  const choices = meal === 'dinner' ? pickerDay?.dinnerChoices : pickerDay?.lunchChoices
  const mealDate = pickerDay?.gregorianDate ?? formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, jd)
  useEffect(() => {
    if (!choices?.some((option) => option.id === menuItemId)) setMenuItemId(choices?.[0]?.id ?? '')
  }, [choices, menuItemId])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  async function createOrder() {
    setFormError('')
    if (!userId || !menuItemId) {
      setFormError('کارمند و آیتم غذا را انتخاب کنید.')
      return
    }
    setFormBusy(true)
    try {
      await orderApi.create({
        userId,
        mealDate,
        mealType: meal === 'dinner' ? 'DINNER' : 'LUNCH',
        menuItemId,
      })
      setNotice('سفارش کارمند ثبت شد')
      setBoot((value) => value + 1)
    } catch (error: unknown) {
      setFormError(error instanceof AuthRequestError ? error.message : 'ثبت سفارش انجام نشد.')
    } finally {
      setFormBusy(false)
    }
  }

  async function changeMeal(order: BackendOrder, nextId: string) {
    try {
      const updated = await orderApi.updateManaged(order.id, nextId)
      setDetail(updated)
      setNotice('سفارش به‌روز شد')
      setBoot((value) => value + 1)
    } catch (error: unknown) {
      setFormError(error instanceof AuthRequestError ? error.message : 'ویرایش سفارش انجام نشد.')
    }
  }

  async function confirmCancel() {
    if (!cancelling) return
    try {
      await orderApi.cancelManaged(cancelling.id)
      setCancelling(null)
      setDetail(null)
      setNotice('سفارش لغو شد')
      setBoot((value) => value + 1)
    } catch (error: unknown) {
      setFormError(error instanceof AuthRequestError ? error.message : 'لغو سفارش انجام نشد.')
    }
  }

  const editChoices = useMemo(() => {
    if (!detail) return []
    const day = published.pickerDays.find((item) => item.gregorianDate === detail.mealDate)
    return (detail.mealType === 'DINNER' ? day?.dinnerChoices : day?.lunchChoices) ?? []
  }, [detail, published.pickerDays])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-5">
          <Field label="تاریخ">
            <select className={controlClass} value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }}>
              <option value="">همه ماه</option>
              {published.pickerDays.filter((day) => day.gregorianDate).map((day) => (
                <option key={day.gregorianDate} value={day.gregorianDate}>{fa(day.jd)} {day.weekday}</option>
              ))}
            </select>
          </Field>
          <Field label="وعده">
            <select className={controlClass} value={mealFilter} onChange={(event) => { setMealFilter(event.target.value as '' | 'LUNCH' | 'DINNER'); setPage(1) }}>
              <option value="">همه</option>
              <option value="LUNCH">ناهار</option>
              <option value="DINNER">شام</option>
            </select>
          </Field>
          <Field label="ساختمان">
            <select className={controlClass} value={buildingFilter} onChange={(event) => { setBuildingFilter(event.target.value); setPage(1) }}>
              <option value="">همه</option>
              {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="وضعیت">
            <select className={controlClass} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as '' | OrderCycleStatus); setPage(1) }}>
              <option value="">همه</option>
              <option value="ACTIVE">فعال</option>
              <option value="CANCELLED">لغو شده</option>
            </select>
          </Field>
          <Field label="جستجوی کارمند">
            <input className={controlClass} value={username} onChange={(event) => { setUsername(event.target.value); setPage(1) }} placeholder="نام کاربری" />
          </Field>
        </div>
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          {notice && <p className="px-4 pt-3 text-sm text-ok" role="status">{notice}</p>}
          {listStatus === 'loading' && <p className="p-4 text-sm text-muted">در حال بارگذاری سفارش‌های کارکنان…</p>}
          {listStatus === 'error' && <div className="space-y-2 p-4"><p className="text-sm text-danger">{listMessage}</p><Button variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button></div>}
          {listStatus === 'forbidden' && <p className="p-4 text-sm text-danger">{listMessage}</p>}
          {listStatus === 'ready' && items.length === 0 && <div className="p-4"><Empty title="سفارشی نیست" body="با فیلترهای فعلی سفارشی از سامانه برنگشت." /></div>}
          {listStatus === 'ready' && items.length > 0 && (
            <>
              <table className="hidden w-full text-sm lg:table">
                <thead className="bg-elevated text-xs text-muted">
                  <tr>
                    {['کارمند', 'ساختمان', 'تاریخ', 'وعده', 'غذا', 'وضعیت', ''].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => (
                    <tr key={order.id} className="border-t border-line">
                      <td className="px-3 py-2">{snapshot(order.currentCycle?.usernameSnapshot)}</td>
                      <td className="px-3 py-2">{snapshot(order.currentCycle?.buildingNameSnapshot)}</td>
                      <td className="px-3 py-2">{order.jalaliDate ?? order.mealDate}</td>
                      <td className="px-3 py-2">{mealLabel(order.mealType)}</td>
                      <td className="px-3 py-2">{snapshot(order.currentCycle?.optionTitle)}</td>
                      <td className="px-3 py-2"><Badge tone={order.status === 'CANCELLED' ? 'danger' : 'ok'}>{order.status === 'CANCELLED' ? 'لغو شده' : 'فعال'}</Badge></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="secondary" onClick={() => void orderApi.getManaged(order.id).then(setDetail).catch((error: unknown) => setFormError(error instanceof AuthRequestError ? error.message : 'جزئیات خوانده نشد.'))}>جزئیات</Button>
                          {order.status === 'ACTIVE' && <Button variant="danger" onClick={() => setCancelling(order)}>لغو</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-2 p-3 lg:hidden">
                {items.map((order) => (
                  <article key={order.id} className="rounded-md border border-line p-3 text-sm">
                    <p className="font-medium">{snapshot(order.currentCycle?.usernameSnapshot)} · {mealLabel(order.mealType)}</p>
                    <p className="mt-1">{snapshot(order.currentCycle?.buildingNameSnapshot)} · {snapshot(order.currentCycle?.optionTitle)}</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" onClick={() => setDetail(order)}>جزئیات</Button>
                      {order.status === 'ACTIVE' && <Button variant="danger" onClick={() => setCancelling(order)}>لغو</Button>}
                    </div>
                  </article>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-line px-3 py-2 text-sm">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
                  <span>{fa(page)} از {fa(pageCount)}</span>
                  <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <form className="space-y-3 rounded-md border border-line bg-surface p-3" onSubmit={(event) => { event.preventDefault(); void createOrder() }}>
        <p className="text-xs text-muted">پشتیبان می‌تواند برای کارمند سفارش ثبت کند. نام غذا و ساختمان از Snapshot سفارش خوانده می‌شود.</p>
        <Field label="کارمند">
          <select className={controlClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
            {users.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}
          </select>
        </Field>
        <Field label="تاریخ">
          <select className={controlClass} value={jd} onChange={(event) => setJd(Number(event.target.value))}>
            {published.pickerDays.map((day) => <option key={day.jd} value={day.jd}>{fa(day.jd)} {JALALI_MONTHS[day.jm - 1]}</option>)}
          </select>
        </Field>
        <Field label="وعده">
          <select className={controlClass} value={meal} onChange={(event) => setMeal(event.target.value as 'lunch' | 'dinner')}>
            <option value="lunch">ناهار</option>
            <option value="dinner">شام</option>
          </select>
        </Field>
        <Field label="آیتم غذا">
          <select className={controlClass} value={menuItemId} onChange={(event) => setMenuItemId(event.target.value)}>
            {(!choices || choices.length === 0) && <option value="">گزینه منتشرشده‌ای نیست</option>}
            {choices?.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </Field>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <Button type="submit" className="w-full" disabled={formBusy}>{formBusy ? 'در حال ثبت...' : 'ثبت سفارش کارمند'}</Button>
      </form>

      <Dialog open={Boolean(detail)} title="جزئیات سفارش" onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-2 text-sm">
            <p>کارمند: {snapshot(detail.currentCycle?.usernameSnapshot)}</p>
            <p>ساختمان: {snapshot(detail.currentCycle?.buildingNameSnapshot)}</p>
            <p>تاریخ: {detail.jalaliDate ?? detail.mealDate}</p>
            <p>وعده: {mealLabel(detail.mealType)}</p>
            <p>غذا: {snapshot(detail.currentCycle?.optionTitle)}</p>
            <p>وضعیت: {detail.status === 'CANCELLED' ? 'لغو شده' : 'فعال'}</p>
            {detail.currentCycle?.groups.length ? <p>گروه‌ها: {detail.currentCycle.groups.map((item) => item.groupNameSnapshot).join('، ')}</p> : null}
            <p className="pt-2 font-medium">تاریخچه چرخه</p>
            {(detail.currentCycle?.statusHistory.length ?? 0) === 0 ? <p className="text-muted">سابقه‌ای در پاسخ نیست.</p> : (
              <ul className="space-y-1">
                {detail.currentCycle?.statusHistory.map((row) => (
                  <li key={row.id}>{row.newStatus}{row.reason ? ` · ${row.reason}` : ''}</li>
                ))}
              </ul>
            )}
            {detail.status === 'ACTIVE' && editChoices.length > 0 && (
              <Field label="تغییر غذا">
                <select className={controlClass} defaultValue={detail.currentCycle?.menuItemId ?? ''} onChange={(event) => void changeMeal(detail, event.target.value)}>
                  {editChoices.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}
      </Dialog>
      <Dialog open={Boolean(cancelling)} title="لغو سفارش کارمند" onClose={() => setCancelling(null)}>
        <p className="text-sm">این سفارش لغو شود؟</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelling(null)}>انصراف</Button>
          <Button variant="danger" onClick={() => void confirmCancel()}>لغو سفارش</Button>
        </div>
      </Dialog>
    </div>
  )
}
