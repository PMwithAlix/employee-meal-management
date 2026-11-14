import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { AuthRequestError } from '../auth/errors'
import { buildingApi, type BuildingSummary } from '../buildings/client'
import { formatGregorianDate } from '../menus/map'
import { usePublishedMenu } from '../menus/usePublishedMenu'
import { fa } from '../lib/text'
import { can } from '../permissions'
import { useApp } from '../store'
import { guestApi } from './client'
import type { BackendGuestOrder, GuestMealType, GuestOrderStatus } from './types'

function mealLabel(meal: GuestMealType) {
  return meal === 'DINNER' ? 'شام' : 'ناهار'
}

function statusLabel(status: GuestOrderStatus) {
  return status === 'CANCELLED' ? 'لغو شده' : 'فعال'
}

function actionLabel(action: string) {
  if (action === 'CREATED') return 'ثبت'
  if (action === 'UPDATED') return 'ویرایش'
  if (action === 'CANCELLED') return 'لغو'
  return action || '—'
}

function snapshotText(value: string | null) {
  return value && value.trim() ? value : '—'
}

function formatInstant(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function GuestsPanel() {
  const app = useApp()
  const allowed = can(app.role, 'guest.edit')
  const published = usePublishedMenu(app.selectedMonth.jy, app.selectedMonth.jm)
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [buildingsStatus, setBuildingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [buildingsMessage, setBuildingsMessage] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [mealFilter, setMealFilter] = useState<'' | GuestMealType>('')
  const [statusFilter, setStatusFilter] = useState<'' | GuestOrderStatus>('')
  const [page, setPage] = useState(1)
  const [boot, setBoot] = useState(0)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
  const [listMessage, setListMessage] = useState('')
  const [items, setItems] = useState<BackendGuestOrder[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const [buildingId, setBuildingId] = useState('')
  const [jd, setJd] = useState(app.days[0]?.jd ?? 1)
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('lunch')
  const [menuItemId, setMenuItemId] = useState('')
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')
  const [countError, setCountError] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const [detail, setDetail] = useState<BackendGuestOrder | null>(null)
  const [editing, setEditing] = useState<BackendGuestOrder | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editNote, setEditNote] = useState('')
  const [editMenuItemId, setEditMenuItemId] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [cancelling, setCancelling] = useState<BackendGuestOrder | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    setBuildingsStatus('loading')
    setBuildingsMessage('')
    void buildingApi.list(controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      setBuildings(listed)
      setBuildingsStatus('ready')
      setBuildingId((current) => current && listed.some((item) => item.id === current && item.isActive) ? current : listed.find((item) => item.isActive)?.id ?? '')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setBuildings([])
      setBuildingsStatus('error')
      setBuildingsMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری ساختمان‌ها انجام نشد.')
    })
    return () => controller.abort()
  }, [allowed])

  useEffect(() => {
    if (!allowed) {
      setItems([])
      setListStatus('forbidden')
      setListMessage('برای این نقش دسترسی به سفارش مهمان وجود ندارد.')
      return
    }
    const controller = new AbortController()
    setListStatus('loading')
    setListMessage('')
    void guestApi.list({
      page,
      pageSize,
      buildingId: buildingFilter || undefined,
      mealDate: dateFilter || undefined,
      mealType: mealFilter || undefined,
      status: statusFilter || undefined,
    }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listed.total) || listed.total < 0 || listed.page !== page || listed.pageSize !== pageSize) {
        setItems([])
        setListStatus('error')
        setListMessage('بارگذاری فهرست سفارش‌های مهمان کامل نشد.')
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
      setListMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری سفارش‌های مهمان انجام نشد.')
    })
    return () => controller.abort()
  }, [allowed, page, pageSize, buildingFilter, dateFilter, mealFilter, statusFilter, boot])

  const pickerDay = published.pickerDays.find((day) => day.jd === jd)
  const mealChoices = meal === 'dinner' ? pickerDay?.dinnerChoices : pickerDay?.lunchChoices
  const mealDate = pickerDay?.gregorianDate ?? formatGregorianDate(app.selectedMonth.jy, app.selectedMonth.jm, jd)

  useEffect(() => {
    if (!mealChoices?.some((option) => option.id === menuItemId)) {
      setMenuItemId(mealChoices?.[0]?.id ?? '')
    }
  }, [jd, meal, mealChoices, menuItemId])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const editChoices = useMemo(() => {
    if (!editing) return []
    const date = published.pickerDays.find((day) => day.gregorianDate === editing.mealDate)
    const options = editing.mealType === 'DINNER' ? date?.dinnerChoices : date?.lunchChoices
    return options ?? []
  }, [editing, published.pickerDays])

  function refresh() {
    setBoot((value) => value + 1)
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (!Number.isInteger(count) || count < 1) {
      setCountError('تعداد باید عدد صحیح بزرگ‌تر یا مساوی ۱ باشد.')
      return
    }
    if (!buildingId) {
      setFormError('ساختمان را انتخاب کنید.')
      return
    }
    if (!menuItemId) {
      setFormError('آیتم غذا را از منوی منتشرشده انتخاب کنید.')
      return
    }
    setCountError('')
    setFormBusy(true)
    try {
      await guestApi.create({
        buildingId,
        mealDate,
        mealType: meal === 'dinner' ? 'DINNER' : 'LUNCH',
        menuItemId,
        quantity: count,
        note: note.trim() || undefined,
      })
      setNote('')
      setNotice('سفارش مهمان ثبت شد')
      refresh()
    } catch (error: unknown) {
      setFormError(error instanceof AuthRequestError ? error.message : 'ثبت سفارش مهمان انجام نشد.')
    } finally {
      setFormBusy(false)
    }
  }

  async function openDetail(id: string) {
    try {
      setDetail(await guestApi.get(id))
    } catch (error: unknown) {
      setNotice('')
      setFormError(error instanceof AuthRequestError ? error.message : 'بارگذاری جزئیات انجام نشد.')
    }
  }

  async function saveEdit() {
    if (!editing) return
    if (!Number.isInteger(editQuantity) || editQuantity < 1) {
      setEditError('تعداد باید عدد صحیح بزرگ‌تر یا مساوی ۱ باشد.')
      return
    }
    setEditBusy(true)
    setEditError('')
    try {
      const updated = await guestApi.update(editing.id, {
        quantity: editQuantity,
        note: editNote.trim() ? editNote.trim() : null,
        ...(editMenuItemId ? { menuItemId: editMenuItemId } : {}),
      })
      setEditing(null)
      setDetail(updated)
      setNotice('سفارش مهمان به‌روز شد')
      refresh()
    } catch (error: unknown) {
      setEditError(error instanceof AuthRequestError ? error.message : 'ویرایش سفارش مهمان انجام نشد.')
    } finally {
      setEditBusy(false)
    }
  }

  async function confirmCancel() {
    if (!cancelling) return
    setCancelBusy(true)
    try {
      await guestApi.cancel(cancelling.id)
      setCancelling(null)
      setDetail(null)
      setNotice('سفارش مهمان لغو شد')
      refresh()
    } catch (error: unknown) {
      setFormError(error instanceof AuthRequestError ? error.message : 'لغو سفارش مهمان انجام نشد.')
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-4">
          <Field label="ساختمان">
            <select className={controlClass} value={buildingFilter} onChange={(event) => { setBuildingFilter(event.target.value); setPage(1) }}>
              <option value="">همه</option>
              {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="تاریخ">
            <select className={controlClass} value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }}>
              <option value="">همه</option>
              {published.pickerDays.filter((day) => day.gregorianDate).map((day) => (
                <option key={day.gregorianDate} value={day.gregorianDate}>{fa(day.jd)} {day.weekday}</option>
              ))}
            </select>
          </Field>
          <Field label="وعده">
            <select className={controlClass} value={mealFilter} onChange={(event) => { setMealFilter(event.target.value as '' | GuestMealType); setPage(1) }}>
              <option value="">همه</option>
              <option value="LUNCH">ناهار</option>
              <option value="DINNER">شام</option>
            </select>
          </Field>
          <Field label="وضعیت">
            <select className={controlClass} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as '' | GuestOrderStatus); setPage(1) }}>
              <option value="">همه</option>
              <option value="ACTIVE">فعال</option>
              <option value="CANCELLED">لغو شده</option>
            </select>
          </Field>
        </div>
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          {listStatus === 'loading' && <p className="p-4 text-sm text-muted">در حال بارگذاری سفارش‌های مهمان...</p>}
          {listStatus === 'error' && (
            <div className="space-y-2 p-4">
              <p className="text-sm text-danger">{listMessage}</p>
              <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
            </div>
          )}
          {listStatus === 'forbidden' && <p className="p-4 text-sm text-danger">{listMessage}</p>}
          {notice && <p className="px-4 pt-3 text-sm text-ok" role="status">{notice}</p>}
          {listStatus === 'ready' && items.length === 0 && (
            <div className="p-4"><Empty title="سفارش مهمانی نیست" body="با فیلترهای فعلی سفارشی پیدا نشد." /></div>
          )}
          {listStatus === 'ready' && items.length > 0 && (
            <>
              <div className="space-y-2 p-3 lg:hidden">
                {items.map((guest) => (
                  <article key={guest.id} className="rounded-md border border-line p-3 text-sm">
                    <p className="font-medium">{guest.jalaliDate ?? guest.mealDate} · {mealLabel(guest.mealType)}</p>
                    <p className="mt-1">{snapshotText(guest.buildingNameSnapshot)} · {snapshotText(guest.mealTitleSnapshot)} · {fa(guest.quantity)} پرس</p>
                    <p className="mt-1 text-muted">{guest.note || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={guest.status === 'CANCELLED' ? 'danger' : 'ok'}>{statusLabel(guest.status)}</Badge>
                      <Button variant="secondary" onClick={() => void openDetail(guest.id)}>جزئیات</Button>
                      {guest.status === 'ACTIVE' && <Button variant="danger" onClick={() => setCancelling(guest)}>لغو</Button>}
                    </div>
                  </article>
                ))}
              </div>
              <table className="hidden w-full text-sm lg:table">
                <thead className="bg-elevated text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">ساختمان</th>
                    <th className="px-3 py-2 text-start font-medium">تاریخ</th>
                    <th className="px-3 py-2 text-start font-medium">وعده</th>
                    <th className="px-3 py-2 text-start font-medium">غذا</th>
                    <th className="px-3 py-2 text-start font-medium">تعداد</th>
                    <th className="px-3 py-2 text-start font-medium">وضعیت</th>
                    <th className="px-3 py-2 text-start font-medium">توضیح</th>
                    <th className="px-3 py-2 text-start font-medium">ثبت</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((guest) => (
                    <tr key={guest.id} className="border-t border-line">
                      <td className="px-3 py-2">{snapshotText(guest.buildingNameSnapshot)}</td>
                      <td className="px-3 py-2">{guest.jalaliDate ?? guest.mealDate}</td>
                      <td className="px-3 py-2">{mealLabel(guest.mealType)}</td>
                      <td className="px-3 py-2">{snapshotText(guest.mealTitleSnapshot)}</td>
                      <td className="px-3 py-2">{fa(guest.quantity)}</td>
                      <td className="px-3 py-2"><Badge tone={guest.status === 'CANCELLED' ? 'danger' : 'ok'}>{statusLabel(guest.status)}</Badge></td>
                      <td className="px-3 py-2">{guest.note || '—'}</td>
                      <td className="px-3 py-2">{formatInstant(guest.createdAt)} · {guest.createdBy}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="secondary" onClick={() => void openDetail(guest.id)}>جزئیات</Button>
                          {guest.status === 'ACTIVE' && (
                            <>
                              <Button variant="secondary" onClick={() => {
                                setEditing(guest)
                                setEditQuantity(guest.quantity)
                                setEditNote(guest.note ?? '')
                                setEditMenuItemId(guest.menuItemId ?? '')
                                setEditError('')
                              }}>ویرایش</Button>
                              <Button variant="danger" onClick={() => setCancelling(guest)}>لغو</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <form className="space-y-3 rounded-md border border-line bg-surface p-3" onSubmit={(event) => void onCreate(event)}>
        <Field label="ساختمان">
          <select className={controlClass} value={buildingId} onChange={(event) => setBuildingId(event.target.value)} disabled={buildingsStatus !== 'ready'}>
            {buildings.every((item) => !item.isActive) && <option value="">ساختمان فعالی موجود نیست</option>}
            {buildings.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        {buildingsStatus === 'error' && <p className="text-sm text-danger">{buildingsMessage}</p>}
        <Field label="تاریخ وعده">
          <select className={controlClass} value={jd} onChange={(event) => setJd(Number(event.target.value))}>
            {app.days.map((day) => <option key={day.jd} value={day.jd}>{fa(day.jd)} {day.weekday}</option>)}
          </select>
        </Field>
        <Field label="نوع وعده">
          <select className={controlClass} value={meal} onChange={(event) => setMeal(event.target.value as 'lunch' | 'dinner')}>
            <option value="lunch">ناهار</option>
            <option value="dinner">شام</option>
          </select>
        </Field>
        <Field label="آیتم غذا">
          <select className={controlClass} value={menuItemId} onChange={(event) => setMenuItemId(event.target.value)}>
            {(!mealChoices || mealChoices.length === 0) && <option value="">گزینه منتشرشده‌ای نیست</option>}
            {mealChoices?.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </Field>
        <Field label="تعداد">
          <input className={controlClass} type="number" min={1} step={1} value={count} onChange={(event) => { setCount(Number(event.target.value)); setCountError('') }} />
        </Field>
        {countError && <p className="text-sm text-danger">{countError}</p>}
        <Field label="توضیحات">
          <input className={controlClass} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <Button type="submit" className="w-full" disabled={formBusy || !allowed || !buildings.some((item) => item.isActive)}>{formBusy ? 'در حال ثبت...' : 'ثبت سفارش مهمان'}</Button>
      </form>

      <Dialog open={Boolean(detail)} title="جزئیات سفارش مهمان" onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-2 text-sm">
            <p>ساختمان: {snapshotText(detail.buildingNameSnapshot)}</p>
            <p>تاریخ: {detail.jalaliDate ?? detail.mealDate}</p>
            <p>وعده: {mealLabel(detail.mealType)}</p>
            <p>غذا: {snapshotText(detail.mealTitleSnapshot)}</p>
            <p>تعداد: {fa(detail.quantity)}</p>
            <p>وضعیت: {statusLabel(detail.status)}</p>
            <p>توضیحات: {detail.note || '—'}</p>
            <p>زمان ثبت: {formatInstant(detail.createdAt)}</p>
            <p>ثبت‌کننده: {detail.createdBy}</p>
            <p className="pt-2 font-medium">تاریخچه تغییرات</p>
            {detail.history.length === 0 ? <p className="text-muted">سابقه‌ای ثبت نشده است.</p> : (
              <ul className="space-y-1">
                {detail.history.map((row) => (
                  <li key={row.id}>{actionLabel(row.action)} · {formatInstant(row.createdAt)} · {row.actorId}</li>
                ))}
              </ul>
            )}
            {detail.status === 'ACTIVE' && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => {
                  setEditing(detail)
                  setEditQuantity(detail.quantity)
                  setEditNote(detail.note ?? '')
                  setEditMenuItemId(detail.menuItemId ?? '')
                  setEditError('')
                }}>ویرایش</Button>
                <Button variant="danger" onClick={() => setCancelling(detail)}>لغو سفارش</Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(editing)} title="ویرایش سفارش مهمان" onClose={() => !editBusy && setEditing(null)}>
        {editing && (
          <div className="space-y-3">
            <Field label="آیتم غذا">
              <select className={controlClass} value={editMenuItemId} onChange={(event) => setEditMenuItemId(event.target.value)}>
                {editChoices.length === 0 && editing.menuItemId && <option value={editing.menuItemId}>{snapshotText(editing.mealTitleSnapshot)}</option>}
                {editChoices.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
            </Field>
            <Field label="تعداد">
              <input className={controlClass} type="number" min={1} step={1} value={editQuantity} onChange={(event) => setEditQuantity(Number(event.target.value))} />
            </Field>
            <Field label="توضیحات">
              <input className={controlClass} value={editNote} onChange={(event) => setEditNote(event.target.value)} />
            </Field>
            {editError && <p className="text-sm text-danger">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={editBusy} onClick={() => setEditing(null)}>انصراف</Button>
              <Button disabled={editBusy} onClick={() => void saveEdit()}>{editBusy ? 'در حال ذخیره...' : 'ذخیره'}</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(cancelling)} title="لغو سفارش مهمان" onClose={() => !cancelBusy && setCancelling(null)}>
        <p className="text-sm">این سفارش مهمان لغو شود؟ این کار در تاریخچه ثبت می‌شود.</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" disabled={cancelBusy} onClick={() => setCancelling(null)}>انصراف</Button>
          <Button variant="danger" disabled={cancelBusy} onClick={() => void confirmCancel()}>{cancelBusy ? 'در حال لغو...' : 'لغو سفارش'}</Button>
        </div>
      </Dialog>
    </div>
  )
}
