import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { buildingApi, type BuildingDetail, type BuildingSummary } from '../features/buildings/api/buildings-api'
import { activeMemberCount } from '../features/buildings/lib/building-mapper'
import { usesLiveBuildingsPage } from '../features/buildings/lib/building-access'
import { isDuplicateBuildingName, normalizeBuildingName } from '../features/buildings/lib/building-name'
import {
  buildingStatusSuccessNotice,
  buildingTransferSuccessNotice,
  noticeAfterBuildingSelection,
} from '../features/buildings/lib/building-notice'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../shared/ui/primitives'
import { can } from '../shared/config/permissions'
import { fa } from '../shared/lib/persian-text'
import { useApp } from '../app/providers/app-store'
import { userApi } from '../features/users/api/users-api'
import { isHrManagedRole, type ManagedUser } from '../features/users/lib/user-mapper'

export function BuildingsPage() {
  const app = useApp()
  if (!usesLiveBuildingsPage(app.role)) return null
  return <LiveBuildingsPage />
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
  const canDelete = can(app.role, 'org.delete')
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
  const [statusConfirmation, setStatusConfirmation] = useState(false)
  const [statusMutation, setStatusMutation] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
    () => users.filter((item) => {
      if (item.buildingId === openId) return false
      if (app.role === 'admin') return item.role !== 'ADMIN'
      return isHrManagedRole(item.role)
    }),
    [users, openId, app.role],
  )

  function refresh() {
    setBoot((value) => value + 1)
  }

  async function confirmDeleteBuilding() {
    if (!building || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await buildingApi.remove(building.id)
      setDeleteConfirmation(false)
      setOpenId('')
      setNotice('ساختمان حذف شد.')
      refresh()
    } catch (error: unknown) {
      setDeleteError(apiMessage(error, 'حذف ساختمان انجام نشد.'))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function changeBuildingStatus() {
    if (!building || statusMutation) return
    setStatusMutation(true)
    setStatusError('')
    try {
      const updated = building.isActive
        ? await buildingApi.deactivate(building.id)
        : await buildingApi.reactivate(building.id)
      setBuildings((items) => items.map((item) => item.id === updated.id ? updated : item))
      setDetail((current) => current?.id === updated.id ? { ...current, isActive: updated.isActive } : current)
      setStatusConfirmation(false)
      setNotice(buildingStatusSuccessNotice(updated.isActive))
    } catch (error: unknown) {
      setStatusError(apiMessage(
        error,
        building.isActive ? 'غیرفعال‌سازی ساختمان انجام نشد.' : 'فعال‌سازی ساختمان انجام نشد.',
      ))
    } finally {
      setStatusMutation(false)
    }
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
      setNotice(buildingTransferSuccessNotice(updated.username))
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
            <button key={item.id} className={`min-h-11 w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => {
              setNotice((current) => noticeAfterBuildingSelection(openId, item.id, current))
              setOpenId(item.id)
            }}>
              <span className="flex items-center justify-between gap-2">
                <span className="block text-sm font-medium">{item.name}</span>
                <Badge tone={item.isActive ? 'ok' : 'neutral'}>{item.isActive ? 'فعال' : 'غیرفعال'}</Badge>
              </span>
              <span className="text-xs text-muted">{fa(count)} حساب فعال</span>
            </button>
          )
        })}
      </div>
      {status === 'ready' && building && (
        <section className="rounded-md border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{building.name}</h2>
              <Badge tone={building.isActive ? 'ok' : 'neutral'}>{building.isActive ? 'فعال' : 'غیرفعال'}</Badge>
            </div>
            {canEditBuilding && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(building.id)}>ویرایش نام</Button>
                <Button
                  variant={building.isActive ? 'danger' : 'primary'}
                  onClick={() => { setStatusError(''); setStatusConfirmation(true) }}
                >
                  {building.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </Button>
                {canDelete && (
                  <Button variant="danger" onClick={() => { setDeleteError(''); setDeleteConfirmation(true) }}>حذف</Button>
                )}
              </div>
            )}
          </div>
          {notice && <p className="mt-2 text-sm text-ok" role="status">{notice}</p>}
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
          {canMoveEmployee && building.isActive && (
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
            </form>
          )}
        </section>
      )}
      {deleteConfirmation && building && (
        <Dialog open title="حذف ساختمان" onClose={() => !deleteBusy && setDeleteConfirmation(false)}>
          <p className="text-sm">ساختمان «{building.name}» برای همیشه حذف شود؟ ابتدا باید هیچ کاربری به آن وصل نباشد. سفارش‌های مهمان همین ساختمان هم پاک می‌شوند.</p>
          {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleteConfirmation(false)}>انصراف</Button>
            <Button variant="danger" disabled={deleteBusy} onClick={() => void confirmDeleteBuilding()}>{deleteBusy ? 'در حال حذف' : 'حذف دائمی'}</Button>
          </div>
        </Dialog>
      )}
      {statusConfirmation && building && (
        <Dialog
          open
          title={building.isActive ? 'غیرفعال‌سازی ساختمان' : 'فعال‌سازی ساختمان'}
          onClose={() => !statusMutation && setStatusConfirmation(false)}
        >
          <p className="text-sm">
            {building.isActive
              ? 'ساختمان فقط زمانی غیرفعال می‌شود که هیچ کارمند فعالی به آن اختصاص نداشته باشد. حساب‌های غیرفعال و سوابق قبلی حفظ می‌شوند.'
              : 'ساختمان دوباره برای تخصیص کاربران و عملیات جدید فعال می‌شود.'}
          </p>
          {statusError && <p className="mt-2 text-sm text-danger">{statusError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={statusMutation} onClick={() => setStatusConfirmation(false)}>انصراف</Button>
            <Button
              variant={building.isActive ? 'danger' : 'primary'}
              disabled={statusMutation}
              onClick={() => void changeBuildingStatus()}
            >
              {statusMutation ? 'در حال ذخیره' : 'تأیید'}
            </Button>
          </div>
        </Dialog>
      )}
      {editing && (
        <LiveBuildingForm
          id={editing === 'new' ? undefined : editing}
          currentName={editing === 'new' ? '' : buildings.find((item) => item.id === editing)?.name ?? detail?.name ?? ''}
          buildings={buildings}
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
  buildings,
  onClose,
  onSaved,
}: {
  id?: string
  currentName: string
  buildings: BuildingSummary[]
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
          const trimmed = normalizeBuildingName(name)
          if (!trimmed) {
            setError('نام ساختمان را وارد کنید.')
            return
          }
          if (isDuplicateBuildingName(trimmed, buildings, id)) {
            setError('نام ساختمان تکراری است.')
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
        <p className="mt-2 text-xs text-muted">نام ساختمان باید یکتا باشد.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button>
          <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'ذخیره'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
