import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../auth/errors'
import { buildingApi, type BuildingDetail, type BuildingSummary } from '../buildings/client'
import { activeMemberCount } from '../buildings/map'
import { Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { fullName } from '../data'
import { can } from '../permissions'
import { fa } from '../lib/text'
import { useApp } from '../store'
import { userApi } from '../users/client'
import { isHrManagedRole, type ManagedUser } from '../users/map'

export function BuildingsPage() {
  const app = useApp()
  if (app.role === 'hr') return <LiveBuildingsPage />
  return <SeedBuildingsPage />
}

function SeedBuildingsPage() {
  const app = useApp()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [openId, setOpenId] = useState(app.buildings[0]?.id ?? '')
  const building = app.buildings.find((item) => item.id === openId)
  const people = app.employees.filter((employee) => employee.buildingId === openId)
  const [moving, setMoving] = useState('')

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        <Button className="w-full" onClick={() => setEditing('new')}>ساختمان جدید</Button>
        {app.buildings.map((item) => {
          const count = app.employees.filter((employee) => employee.active && employee.buildingId === item.id).length
          return (
            <button key={item.id} className={`min-h-11 w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => setOpenId(item.id)}>
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{fa(count)} کارمند فعال</span>
            </button>
          )
        })}
      </div>
      {building && (
        <section className="rounded-md border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{building.name}</h2>
            <Button variant="secondary" onClick={() => setEditing(building.id)}>ویرایش نام</Button>
          </div>
          <p className="mt-2 text-sm text-muted">{fa(people.length)} نفر به این ساختمان وصل‌اند، از جمله حساب‌های غیرفعال.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {people.map((employee) => (
              <li key={employee.id} className="flex justify-between py-2">
                <span>{fullName(employee)}</span>
                <span className="text-muted">{employee.active ? 'فعال' : 'غیرفعال'}</span>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 space-y-2 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!moving) return
              app.assignBuilding(moving, building.id)
              setMoving('')
            }}
          >
            <p className="text-sm font-medium">انتقال کارمند به این ساختمان</p>
            <p className="text-xs text-muted">هر کارمند فقط یک ساختمان دارد. سفارش‌های قبلی با ساختمان زمان ثبت باقی می‌مانند.</p>
            <div className="flex flex-wrap gap-2">
              <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" aria-label="کارمند برای انتقال" value={moving} onChange={(event) => setMoving(event.target.value)}>
                <option value="">انتخاب کارمند</option>
                {app.employees.filter((employee) => employee.buildingId !== building.id).map((employee) => (
                  <option key={employee.id} value={employee.id}>{fullName(employee)}</option>
                ))}
              </select>
              <Button type="submit" disabled={!moving}>انتقال</Button>
            </div>
          </form>
        </section>
      )}
      {editing && <SeedBuildingForm id={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onCreated={setOpenId} />}
    </div>
  )
}

function SeedBuildingForm({ id, onClose, onCreated }: { id?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const app = useApp()
  const current = app.buildings.find((item) => item.id === id)
  const [name, setName] = useState(current?.name ?? '')
  const [error, setError] = useState('')
  return (
    <Dialog open title={id ? 'ویرایش ساختمان' : 'ساختمان جدید'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) {
            setError('نام ساختمان را وارد کنید.')
            return
          }
          const nextId = app.saveBuilding(name, id)
          if (nextId && !id) onCreated(nextId)
          onClose()
        }}
      >
        <Field label="نام ساختمان"><input className={controlClass} value={name} onChange={(event) => { setName(event.target.value); setError('') }} /></Field>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">در محدوده فعلی محصول، ساختمان فقط نام دارد.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button type="submit">ذخیره</Button>
        </div>
      </form>
    </Dialog>
  )
}

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof AuthRequestError) {
    return error.issues.length ? `${error.message} ${error.issues.join(' ')}`.trim() : error.message
  }
  return fallback
}

function LiveBuildingsPage() {
  const app = useApp()
  const canEditBuilding = can(app.role, 'building.edit')
  const canMoveEmployee = can(app.role, 'employee.edit')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [openId, setOpenId] = useState('')
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [detail, setDetail] = useState<BuildingDetail | null>(null)
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [detailMessage, setDetailMessage] = useState('')
  const [moving, setMoving] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    void Promise.all([
      buildingApi.list(controller.signal),
      userApi.listAll({}, controller.signal),
    ]).then(([listedBuildings, listedUsers]) => {
      if (controller.signal.aborted) return
      setBuildings(listedBuildings)
      setUsers(listedUsers.items)
      setStatus('ready')
      setOpenId((current) => listedBuildings.some((item) => item.id === current) ? current : listedBuildings[0]?.id ?? '')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setBuildings([])
      setUsers([])
      setOpenId('')
      setStatus('error')
      setMessage(apiMessage(error, 'بارگذاری ساختمان‌ها انجام نشد.'))
    })
    return () => controller.abort()
  }, [boot])

  useEffect(() => {
    if (!openId) {
      setDetail(null)
      setDetailStatus('idle')
      return
    }
    const controller = new AbortController()
    setDetailStatus('loading')
    setDetailMessage('')
    void buildingApi.get(openId, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return
      setDetail(loaded)
      setDetailStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDetail(null)
      setDetailStatus('error')
      setDetailMessage(apiMessage(error, 'بارگذاری جزئیات ساختمان انجام نشد.'))
    })
    return () => controller.abort()
  }, [openId, boot])

  const building = detail && detail.id === openId ? detail : buildings.find((item) => item.id === openId) ?? null
  const people = useMemo(() => users.filter((item) => item.buildingId === openId), [users, openId])
  const movers = useMemo(
    () => users.filter((item) => item.buildingId !== openId && isHrManagedRole(item.role)),
    [users, openId],
  )

  function refresh() {
    setBoot((value) => value + 1)
  }

  async function transfer(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!moving || !building || transferBusy) return
    setTransferBusy(true)
    setTransferError('')
    setNotice('')
    try {
      const updated = await userApi.update(moving, { buildingId: building.id })
      setUsers((list) => list.map((item) => (item.id === updated.id ? updated : item)))
      setMoving('')
      setNotice(`حساب ${updated.username} به این ساختمان منتقل شد.`)
      refresh()
    } catch (error: unknown) {
      setTransferError(apiMessage(error, 'انتقال کارمند انجام نشد.'))
    } finally {
      setTransferBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        {canEditBuilding && <Button className="w-full" onClick={() => setEditing('new')}>ساختمان جدید</Button>}
        {status === 'loading' && <p className="text-sm text-muted">در حال بارگذاری ساختمان‌ها…</p>}
        {status === 'error' && (
          <div className="space-y-2">
            <Empty title="ساختمان‌ها از سامانه خوانده نشد" body={message} />
            <Button variant="secondary" className="w-full" onClick={refresh}>تلاش دوباره</Button>
          </div>
        )}
        {status === 'ready' && buildings.length === 0 && <Empty title="ساختمانی نیست" body="ساختمان جدید بسازید." />}
        {status === 'ready' && buildings.map((item) => {
          const count = activeMemberCount(users, item.id)
          return (
            <button key={item.id} className={`min-h-11 w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => setOpenId(item.id)}>
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{fa(count)} کارمند فعال</span>
            </button>
          )
        })}
      </div>
      {status === 'ready' && building && (
        <section className="rounded-md border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{building.name}</h2>
            {canEditBuilding && <Button variant="secondary" onClick={() => setEditing(building.id)}>ویرایش نام</Button>}
          </div>
          {detailStatus === 'loading' && <p className="mt-2 text-sm text-muted">در حال خواندن جزئیات ساختمان…</p>}
          {detailStatus === 'error' && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-danger">{detailMessage}</p>
              <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
            </div>
          )}
          <p className="mt-2 text-sm text-muted">{fa(detail?.usersCount ?? people.length)} نفر به این ساختمان وصل‌اند، از جمله حساب‌های غیرفعال.</p>
          {people.length === 0 ? <p className="mt-3 text-sm text-muted">عضوی برای این ساختمان ثبت نشده است.</p> : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {people.map((employee) => (
                <li key={employee.id} className="flex justify-between py-2">
                  <span dir="ltr">{employee.username}</span>
                  <span className="text-muted">{employee.isActive ? 'فعال' : 'غیرفعال'}</span>
                </li>
              ))}
            </ul>
          )}
          {canMoveEmployee && (
            <form className="mt-4 space-y-2 border-t border-line pt-4" onSubmit={(event) => void transfer(event)}>
              <p className="text-sm font-medium">انتقال کارمند به این ساختمان</p>
              <p className="text-xs text-muted">هر کارمند فقط یک ساختمان دارد. سفارش‌های قبلی با ساختمان زمان ثبت باقی می‌مانند.</p>
              <div className="flex flex-wrap gap-2">
                <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" aria-label="کارمند برای انتقال" value={moving} onChange={(event) => setMoving(event.target.value)} disabled={transferBusy}>
                  <option value="">انتخاب کارمند</option>
                  {movers.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.username}</option>
                  ))}
                </select>
                <Button type="submit" disabled={!moving || transferBusy}>{transferBusy ? 'در حال انتقال' : 'انتقال'}</Button>
              </div>
              {transferError && <p className="text-sm text-danger">{transferError}</p>}
              {notice && <p className="text-sm text-ok" role="status">{notice}</p>}
            </form>
          )}
        </section>
      )}
      {editing && (
        <LiveBuildingForm
          id={editing === 'new' ? undefined : editing}
          currentName={editing === 'new' ? '' : buildings.find((item) => item.id === editing)?.name ?? detail?.name ?? ''}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setOpenId(id)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function LiveBuildingForm({
  id,
  currentName,
  onClose,
  onSaved,
}: {
  id?: string
  currentName: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open title={id ? 'ویرایش ساختمان' : 'ساختمان جدید'} onClose={onClose} locked={saving}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (saving) return
          const trimmed = name.trim()
          if (!trimmed) {
            setError('نام ساختمان را وارد کنید.')
            return
          }
          setSaving(true)
          setError('')
          const request = id ? buildingApi.update(id, trimmed) : buildingApi.create(trimmed)
          void request.then((saved) => {
            onSaved(saved.id)
            onClose()
          }).catch((caught: unknown) => {
            setError(apiMessage(caught, id ? 'ویرایش ساختمان انجام نشد.' : 'ایجاد ساختمان انجام نشد.'))
          }).finally(() => {
            setSaving(false)
          })
        }}
      >
        <Field label="نام ساختمان"><input className={controlClass} value={name} onChange={(event) => { setName(event.target.value); setError('') }} /></Field>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">در محدوده فعلی محصول، ساختمان فقط نام دارد.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button>
          <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'ذخیره'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
