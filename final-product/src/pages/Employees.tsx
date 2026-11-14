import { useEffect, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { AuthRequestError } from '../auth/errors'
import { buildingApi, type BuildingSummary } from '../buildings/client'
import { CredentialHandoff } from '../components/CredentialHandoff'
import { SecretField } from '../components/SecretField'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { groupApi } from '../groups/client'
import { generatePassword, normalizeUsername, passwordIssue, sanitizeUsernameInput, usernameIssue } from '../lib/credentials'
import { can } from '../permissions'
import { cn, fa } from '../lib/text'
import { useApp } from '../store'
import { ADMIN_DIRECTORY_ROLES, isDirectoryRole, usesLiveEmployeesPage, type DirectoryRole } from '../users/access'
import { userApi } from '../users/client'
import { formatUserCreatedAt, HR_MANAGED_ROLES, roleLabel, type HrManagedRole, type ManagedUser } from '../users/map'

export function EmployeesPage() {
  const app = useApp()
  if (!usesLiveEmployeesPage(app.role)) return null
  return <LiveEmployeesPage />
}

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof AuthRequestError) {
    return error.issues.length ? `${error.message} ${error.issues.join(' ')}`.trim() : error.message
  }
  return fallback
}

function LiveEmployeesPage() {
  const app = useApp()
  const canEdit = can(app.role, 'employee.edit')
  const isAdmin = app.role === 'admin'
  const [q, setQ] = useState('')
  const [buildingId, setBuildingId] = useState('all')
  const [role, setRole] = useState<'all' | DirectoryRole | HrManagedRole>(isAdmin ? 'all' : 'EMPLOYEE')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [boot, setBoot] = useState(0)
  const pageSize = 20
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [groupNames, setGroupNames] = useState<Record<string, string[]>>({})
  const [refStatus, setRefStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [refMessage, setRefMessage] = useState('')
  const [groupsMessage, setGroupsMessage] = useState('')
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listMessage, setListMessage] = useState('')
  const [items, setItems] = useState<ManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [resetting, setResetting] = useState(false)
  const [confirming, setConfirming] = useState<ManagedUser | null>(null)
  const [mutating, setMutating] = useState(false)
  const [actionError, setActionError] = useState('')
  const [resetHandoff, setResetHandoff] = useState<{ username: string; password: string } | null>(null)
  const current = items.find((item) => item.id === selected) ?? null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    const controller = new AbortController()
    setRefStatus('loading')
    setRefMessage('')
    void buildingApi.list(controller.signal).then(async (listedBuildings) => {
      if (controller.signal.aborted) return
      setBuildings(listedBuildings)
      setRefStatus('ready')
      setGroupsMessage('')
      try {
        const listedGroups = await groupApi.list(controller.signal)
        const memberships: Record<string, string[]> = {}
        await Promise.all(listedGroups.map(async (group) => {
          const memberIds = await groupApi.members(group.id, controller.signal)
          for (const userId of memberIds) {
            memberships[userId] = [...(memberships[userId] ?? []), group.name]
          }
        }))
        if (controller.signal.aborted) return
        setGroupNames(memberships)
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        setGroupNames({})
        setGroupsMessage(apiMessage(error, 'بارگذاری گروه‌ها انجام نشد.'))
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setBuildings([])
      setGroupNames({})
      setRefStatus('error')
      setRefMessage(apiMessage(error, 'بارگذاری ساختمان‌ها انجام نشد.'))
    })
    return () => controller.abort()
  }, [boot])

  useEffect(() => {
    const controller = new AbortController()
    setListStatus('loading')
    setListMessage('')
    void userApi.list({
      page,
      pageSize,
      username: q.trim() || undefined,
      role: role === 'all' ? undefined : role,
      buildingId: buildingId === 'all' ? undefined : buildingId,
      isActive: status === 'all' ? undefined : status === 'active',
    }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listed.total) || listed.page !== page || listed.pageSize !== pageSize) {
        setItems([])
        setTotal(0)
        setListStatus('error')
        setListMessage('بارگذاری فهرست کارکنان کامل نشد.')
        return
      }
      setItems(listed.items)
      setTotal(listed.total)
      setListStatus('ready')
      setSelected((currentId) => currentId && listed.items.some((item) => item.id === currentId) ? currentId : listed.items[0]?.id ?? null)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
      setTotal(0)
      setSelected(null)
      setListStatus('error')
      setListMessage(apiMessage(error, 'بارگذاری فهرست کارکنان انجام نشد.'))
    })
    return () => controller.abort()
  }, [q, buildingId, role, status, page, pageSize, boot])

  function refresh() {
    setBoot((value) => value + 1)
  }

  async function confirmStatus() {
    if (!confirming || mutating) return
    setMutating(true)
    setActionError('')
    try {
      const updated = confirming.isActive ? await userApi.deactivate(confirming.id) : await userApi.reactivate(confirming.id)
      setConfirming(null)
      setItems((list) => list.map((item) => (item.id === updated.id ? updated : item)))
      refresh()
    } catch (error: unknown) {
      setActionError(apiMessage(error, 'تغییر وضعیت حساب انجام نشد.'))
    } finally {
      setMutating(false)
    }
  }

  const groupsOf = (id: string) => groupNames[id]?.join('، ') || '—'
  const filteredEmpty = Boolean(q.trim() || buildingId !== 'all' || status !== 'all')

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="نام کاربری" aria-label="جستجوی کارمند" className="h-11 min-w-0 flex-1 basis-full rounded-md border border-line bg-surface px-3 text-base sm:basis-48" />
          <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-base" value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setPage(1) }}>
            <option value="all">همه ساختمان‌ها</option>
            {buildings.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-base" value={role} onChange={(event) => { setRole(event.target.value as 'all' | DirectoryRole | HrManagedRole); setPage(1) }}>
            {isAdmin && <option value="all">همه نقش‌ها</option>}
            {(isAdmin ? ADMIN_DIRECTORY_ROLES : HR_MANAGED_ROLES).map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
          <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-base" value={status} onChange={(event) => { setStatus(event.target.value as 'all' | 'active' | 'inactive'); setPage(1) }}>
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
          {canEdit && <Button onClick={() => setEditing('new')}>{isAdmin ? 'حساب جدید' : 'کارمند جدید'}</Button>}
        </div>
        {refStatus === 'error' && (
          <div className="space-y-2">
            <Empty title="اطلاعات تکمیلی خوانده نشد" body={refMessage} />
            <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
          </div>
        )}
        {groupsMessage && <p className="text-sm text-danger">{groupsMessage}</p>}
        {listStatus === 'loading' && <p className="text-sm text-muted">در حال بارگذاری کارکنان…</p>}
        {listStatus === 'error' && (
          <div className="space-y-2">
            <Empty title="فهرست کارکنان از سامانه خوانده نشد" body={listMessage} />
            <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
          </div>
        )}
        {listStatus === 'ready' && items.length === 0 && <Empty title={filteredEmpty ? 'نتیجه‌ای پیدا نشد' : 'کارمندی نیست'} body="عبارت جستجو یا فیلتر را تغییر دهید." />}
        {listStatus === 'ready' && items.length > 0 && (
          <>
            <div className="space-y-2 lg:hidden">
              {items.map((employee) => (
                <button key={employee.id} type="button" className={cn('min-h-11 w-full rounded-md border border-line bg-surface p-3 text-start', selected === employee.id && 'border-primary bg-brandsubtle')} onClick={() => setSelected(employee.id)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium" dir="ltr">{employee.username}</span>
                    <Badge tone={employee.isActive ? 'ok' : 'neutral'}>{employee.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                  </span>
                  <span className="mt-1 block text-sm">{roleLabel(employee.role)}</span>
                  <span className="mt-1 block text-sm">{employee.buildingName || buildings.find((item) => item.id === employee.buildingId)?.name || '—'}</span>
                  <span className="mt-1 block text-sm text-muted">{groupsOf(employee.id)}</span>
                </button>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-md border border-line bg-surface lg:block">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs text-muted">
                  <tr>
                    {['نام کاربری', 'نقش', 'ساختمان', 'گروه‌ها', 'وضعیت', 'تاریخ ایجاد'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((employee) => (
                    <tr key={employee.id} className={cn('cursor-pointer border-t border-divider hover:bg-surface2', selected === employee.id && 'bg-brandsubtle')} onClick={() => setSelected(employee.id)}>
                      <td className="px-3 py-2" dir="ltr">{employee.username}</td>
                      <td className="px-3 py-2">{roleLabel(employee.role)}</td>
                      <td className="px-3 py-2">{employee.buildingName || buildings.find((item) => item.id === employee.buildingId)?.name || '—'}</td>
                      <td className="px-3 py-2">{groupsOf(employee.id)}</td>
                      <td className="px-3 py-2"><Badge tone={employee.isActive ? 'ok' : 'neutral'}>{employee.isActive ? 'فعال' : 'غیرفعال'}</Badge></td>
                      <td className="px-3 py-2 text-muted">{formatUserCreatedAt(employee.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between text-sm">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
                <span>{fa(page)} / {fa(pageCount)}</span>
                <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
              </div>
            )}
          </>
        )}
        {actionError && <p className="text-sm text-danger">{actionError}</p>}
      </div>
      {current && (
        <aside className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold" dir="ltr">{current.username}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="نقش" value={roleLabel(current.role)} />
            <Row label="ساختمان" value={current.buildingName || buildings.find((item) => item.id === current.buildingId)?.name || '—'} />
            <Row label="گروه‌ها" value={groupsOf(current.id)} />
            <Row label="وضعیت" value={current.isActive ? 'فعال' : 'غیرفعال'} />
            <Row label="تاریخ ایجاد" value={formatUserCreatedAt(current.createdAt)} />
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            {canEdit && <Button variant="secondary" onClick={() => setEditing(current.id)}>ویرایش</Button>}
            {canEdit && <Button variant="secondary" onClick={() => setResetting(true)}>بازنشانی رمز عبور</Button>}
            {canEdit && (
              <Button variant={current.isActive ? 'danger' : 'primary'} onClick={() => setConfirming(current)}>
                {current.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">حذف حساب انجام نمی‌شود. وضعیت حساب بین فعال و غیرفعال عوض می‌شود.</p>
        </aside>
      )}
      {editing && (
        <LiveEmployeeForm
          id={editing === 'new' ? undefined : editing}
          current={editing === 'new' ? null : current}
          buildings={buildings}
          allowAllRoles={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setPage(1); refresh() }}
        />
      )}
      {resetting && current && (
        <LiveResetPasswordDialog
          employee={current}
          onClose={() => setResetting(false)}
          onReset={(username, password) => {
            setResetting(false)
            setResetHandoff({ username, password })
          }}
        />
      )}
      {confirming && (
        <Dialog open title={confirming.isActive ? 'غیرفعال‌سازی حساب' : 'فعال‌سازی حساب'} onClose={() => !mutating && setConfirming(null)}>
          <p className="text-sm">حساب <span dir="ltr">{confirming.username}</span> {confirming.isActive ? 'غیرفعال شود؟' : 'فعال شود؟'}</p>
          {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={mutating} onClick={() => setConfirming(null)}>انصراف</Button>
            <Button variant={confirming.isActive ? 'danger' : 'primary'} disabled={mutating} onClick={() => void confirmStatus()}>{mutating ? 'در حال ذخیره' : 'تأیید'}</Button>
          </div>
        </Dialog>
      )}
      {resetHandoff && (
        <Dialog open title="رمز جدید برای تحویل" onClose={() => setResetHandoff(null)}>
          <CredentialHandoff username={resetHandoff.username} password={resetHandoff.password} title="رمز عبور در این نشست بازنشانی شد." onDone={() => setResetHandoff(null)} />
        </Dialog>
      )}
    </div>
  )
}

function LiveEmployeeForm({
  id,
  current,
  buildings,
  allowAllRoles,
  onClose,
  onSaved,
}: {
  id?: string
  current: ManagedUser | null
  buildings: BuildingSummary[]
  allowAllRoles: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const creating = !id
  const [username, setUsername] = useState(current?.username ?? '')
  const [password, setPassword] = useState('')
  const [assignedRole, setAssignedRole] = useState<DirectoryRole>(allowAllRoles && current && isDirectoryRole(current.role) ? current.role : 'EMPLOYEE')
  const [buildingId, setBuildingId] = useState(buildings.find((item) => item.id === current?.buildingId && item.isActive)?.id ?? buildings.find((item) => item.isActive)?.id ?? '')
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [handoff, setHandoff] = useState<{ username: string; password: string } | null>(null)
  const normalized = normalizeUsername(username)
  const needsBuilding = assignedRole !== 'ADMIN'
  const fields = {
    username: creating ? usernameIssue(normalized) : '',
    password: creating ? passwordIssue(password) : '',
    building: needsBuilding && !buildingId ? 'ساختمان را انتخاب کنید.' : '',
  }

  return (
    <Dialog open title={handoff ? 'اطلاعات ورود' : id ? 'ویرایش حساب' : allowAllRoles ? 'حساب جدید' : 'کارمند جدید'} onClose={onClose} wide locked={saving}>
      {handoff ? (
        <CredentialHandoff username={handoff.username} password={handoff.password} title="حساب ساخته شد. این رمز را از کانال دیگری به کارمند بدهید." onDone={onClose} />
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (saving) return
            if (fields.username || fields.password || fields.building) {
              setTried(true)
              return
            }
            setSaving(true)
            setError('')
            const nextBuilding = needsBuilding ? buildingId : (buildingId || null)
            const request = creating
              ? userApi.create({ username: normalized, password, role: assignedRole, buildingId: nextBuilding ?? undefined })
              : userApi.update(id, allowAllRoles ? { buildingId: nextBuilding, role: assignedRole } : { buildingId })
            void request.then(() => {
              onSaved()
              if (creating) setHandoff({ username: normalized, password })
              else onClose()
            }).catch((caught: unknown) => {
              setError(apiMessage(caught, creating ? 'ایجاد کارمند انجام نشد.' : 'ویرایش کارمند انجام نشد.'))
            }).finally(() => {
              setSaving(false)
            })
          }}
        >
          <Field label="نام کاربری">
            <input
              className={controlClass}
              dir="ltr"
              value={creating ? username : current?.username ?? ''}
              autoComplete="off"
              readOnly={!creating}
              onChange={(event) => setUsername(sanitizeUsernameInput(event.target.value))}
              onBlur={() => setUsername(normalized)}
            />
            {creating && <p className="mt-1 text-xs text-muted">فقط حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط. حروف بزرگ به کوچک تبدیل می‌شوند.</p>}
            {tried && fields.username && <p className="mt-1 text-sm text-danger">{fields.username}</p>}
          </Field>
          {allowAllRoles && (
            <Field label="نقش">
              <select className={controlClass} value={assignedRole} onChange={(event) => setAssignedRole(event.target.value as DirectoryRole)}>
                {ADMIN_DIRECTORY_ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
              </select>
            </Field>
          )}
          {creating && (
            <div className="sm:col-span-2">
              <SecretField
                label="رمز عبور اولیه"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                error={tried ? fields.password : ''}
                actions={(
                  <>
                    <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2" aria-label="تولید رمز تصادفی" onClick={() => setPassword(generatePassword())}>
                      <RefreshCw size={16} />
                    </button>
                    <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2" aria-label="کپی رمز" onClick={() => { if (password) void navigator.clipboard.writeText(password) }}>
                      <Copy size={16} />
                    </button>
                  </>
                )}
              />
              <p className="mt-1 text-xs text-muted">رمز در پروفایل کارمند یا حافظه پایدار ذخیره نمی‌شود. پس از ذخیره، صفحه تحویل اطلاعات نمایش داده می‌شود.</p>
            </div>
          )}
          <Field label="ساختمان">
            <select className={controlClass} value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
              <option value="">انتخاب ساختمان</option>
              {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {tried && fields.building && <p className="mt-1 text-sm text-danger">{fields.building}</p>}
          </Field>
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'ذخیره'}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function LiveResetPasswordDialog({
  employee,
  onClose,
  onReset,
}: {
  employee: ManagedUser
  onClose: () => void
  onReset: (username: string, password: string) => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const issue = passwordIssue(password)

  return (
    <Dialog open title="بازنشانی رمز عبور" onClose={onClose} locked={saving}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setTried(true)
          if (issue || saving) return
          setSaving(true)
          setError('')
          void userApi.resetPassword(employee.id, password).then(() => {
            onReset(employee.username, password)
          }).catch((caught: unknown) => {
            setError(apiMessage(caught, 'بازنشانی رمز عبور انجام نشد.'))
          }).finally(() => {
            setSaving(false)
          })
        }}
      >
        <p className="text-sm text-muted">رمز فعلی کارمند لازم نیست. پس از تأیید، اعلان برای همان کارمند ساخته می‌شود و رمز در اعلان نمی‌آید.</p>
        <Field label="نام کاربری">
          <input className={controlClass} dir="ltr" value={employee.username} readOnly />
        </Field>
        <SecretField
          label="رمز عبور جدید"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={tried ? issue : ''}
          actions={(
            <>
              <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2" aria-label="تولید رمز تصادفی" onClick={() => setPassword(generatePassword())}>
                <RefreshCw size={16} />
              </button>
              <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted hover:bg-surface2" aria-label="کپی رمز" onClick={() => { if (password) void navigator.clipboard.writeText(password) }}>
                <Copy size={16} />
              </button>
            </>
          )}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button>
          <Button type="submit" disabled={saving}>{saving ? 'در حال ذخیره' : 'تأیید بازنشانی'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end">{value}</dd>
    </div>
  )
}
