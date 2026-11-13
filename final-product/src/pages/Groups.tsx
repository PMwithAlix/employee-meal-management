import { useEffect, useMemo, useState } from 'react'
import { AuthRequestError } from '../auth/errors'
import { Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { usesLiveGroupsPage } from '../groups/access'
import { groupApi, type DirectoryGroup, type GroupDetail, type GroupMember, type GroupMembershipHistory } from '../groups/client'
import { formatGroupInstant } from '../groups/map'
import { can } from '../permissions'
import { fa } from '../lib/text'
import { useApp } from '../store'
import { userApi } from '../users/client'
import type { ManagedUser } from '../users/map'

export function GroupsPage() {
  const app = useApp()
  if (!usesLiveGroupsPage(app.role)) return null
  return <LiveGroupsPage />
}

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof AuthRequestError) {
    return error.issues.length ? `${error.message} ${error.issues.join(' ')}`.trim() : error.message
  }
  return fallback
}

function LiveGroupsPage() {
  const app = useApp()
  const canEdit = can(app.role, 'group.edit')
  const [openId, setOpenId] = useState('')
  const [creating, setCreating] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [rename, setRename] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [adding, setAdding] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')
  const [removing, setRemoving] = useState('')
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateBusy, setDeactivateBusy] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')
  const [notice, setNotice] = useState('')
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [groups, setGroups] = useState<DirectoryGroup[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [history, setHistory] = useState<GroupMembershipHistory[]>([])
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [detailMessage, setDetailMessage] = useState('')
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [historyMessage, setHistoryMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')
    void Promise.all([
      groupApi.list(controller.signal),
      userApi.listAll({}, controller.signal),
    ]).then(async ([listed, listedUsers]) => {
      const nextCounts: Record<string, number> = {}
      await Promise.all(listed.map(async (item) => {
        try {
          const loaded = await groupApi.get(item.id, controller.signal)
          if (loaded.memberCount !== null) nextCounts[item.id] = loaded.memberCount
        } catch (error) {
          if (controller.signal.aborted) throw error
        }
      }))
      if (controller.signal.aborted) return
      setGroups(listed)
      setCounts(nextCounts)
      setUsers(listedUsers.items)
      setStatus('ready')
      setOpenId((current) => listed.some((item) => item.id === current) ? current : listed[0]?.id ?? '')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setGroups([])
      setCounts({})
      setUsers([])
      setOpenId('')
      setStatus('error')
      setMessage(apiMessage(error, 'بارگذاری گروه‌ها انجام نشد.'))
    })
    return () => controller.abort()
  }, [boot])

  useEffect(() => {
    if (!openId) {
      setDetail(null)
      setMembers([])
      setHistory([])
      setDetailStatus('idle')
      setHistoryStatus('idle')
      return
    }
    const controller = new AbortController()
    setDetailStatus('loading')
    setHistoryStatus('loading')
    setDetailMessage('')
    setHistoryMessage('')
    const selected = groups.find((item) => item.id === openId)
    if (selected) setRename(selected.name)
    void Promise.all([
      groupApi.get(openId, controller.signal),
      groupApi.listMembers(openId, controller.signal),
    ]).then(([loaded, listedMembers]) => {
      if (controller.signal.aborted) return
      setDetail(loaded)
      setMembers(listedMembers)
      setRename(loaded.name)
      setCounts((current) => loaded.memberCount === null ? current : { ...current, [loaded.id]: loaded.memberCount })
      setDetailStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setDetail(null)
      setMembers([])
      setDetailStatus('error')
      setDetailMessage(apiMessage(error, 'بارگذاری جزئیات گروه انجام نشد.'))
    })
    void groupApi.history(openId, controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      setHistory(rows)
      setHistoryStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setHistory([])
      setHistoryStatus('error')
      setHistoryMessage(apiMessage(error, 'بارگذاری تاریخچه عضویت انجام نشد.'))
    })
    return () => controller.abort()
  }, [openId, boot])

  const group = detail && detail.id === openId ? detail : groups.find((item) => item.id === openId) ?? null
  const memberIds = useMemo(() => new Set(members.map((item) => item.userId)), [members])
  const others = useMemo(
    () => users.filter((item) => item.isActive && !memberIds.has(item.id)),
    [users, memberIds],
  )

  function refresh() {
    setBoot((value) => value + 1)
  }

  async function createGroup(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!creating.trim() || createBusy || !canEdit) return
    setCreateBusy(true)
    setCreateError('')
    setNotice('')
    try {
      const created = await groupApi.create(creating.trim())
      setCreating('')
      setOpenId(created.id)
      setNotice('گروه ساخته شد.')
      refresh()
    } catch (error: unknown) {
      setCreateError(apiMessage(error, 'ایجاد گروه انجام نشد.'))
    } finally {
      setCreateBusy(false)
    }
  }

  async function saveName(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!group || renameBusy || !canEdit) return
    const next = rename.trim()
    if (!next) {
      setRenameError('نام گروه را وارد کنید.')
      return
    }
    setRenameBusy(true)
    setRenameError('')
    setNotice('')
    try {
      const updated = await groupApi.update(group.id, next)
      setGroups((list) => list.map((item) => (item.id === updated.id ? updated : item)))
      setDetail((current) => current && current.id === updated.id ? { ...current, ...updated } : current)
      setRename(updated.name)
      setNotice('نام گروه ذخیره شد.')
    } catch (error: unknown) {
      setRenameError(apiMessage(error, 'ویرایش نام گروه انجام نشد.'))
    } finally {
      setRenameBusy(false)
    }
  }

  async function addMember(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!group || !adding || addBusy || !canEdit) return
    setAddBusy(true)
    setAddError('')
    setNotice('')
    try {
      await groupApi.addMember(group.id, adding)
      setAdding('')
      setNotice('عضو به گروه اضافه شد.')
      refresh()
    } catch (error: unknown) {
      setAddError(apiMessage(error, 'افزودن عضو انجام نشد.'))
    } finally {
      setAddBusy(false)
    }
  }

  async function confirmRemove() {
    if (!group || !removing || removeBusy) return
    setRemoveBusy(true)
    setRemoveError('')
    setNotice('')
    try {
      await groupApi.removeMember(group.id, removing)
      setRemoving('')
      setNotice('عضو از گروه خارج شد.')
      refresh()
    } catch (error: unknown) {
      setRemoveError(apiMessage(error, 'حذف عضو انجام نشد.'))
    } finally {
      setRemoveBusy(false)
    }
  }

  async function confirmDeactivate() {
    if (!group || deactivateBusy) return
    setDeactivateBusy(true)
    setDeactivateError('')
    setNotice('')
    try {
      await groupApi.deactivate(group.id)
      setDeactivating(false)
      setNotice('گروه غیرفعال شد.')
      refresh()
    } catch (error: unknown) {
      setDeactivateError(apiMessage(error, 'غیرفعال‌سازی گروه انجام نشد.'))
    } finally {
      setDeactivateBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        {canEdit && (
          <form className="flex gap-2" onSubmit={(event) => void createGroup(event)}>
            <input value={creating} onChange={(event) => { setCreating(event.target.value); setCreateError('') }} placeholder="گروه جدید" aria-label="نام گروه جدید" className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-base" disabled={createBusy} />
            <Button type="submit" disabled={createBusy || !creating.trim()}>{createBusy ? 'در حال ساخت' : 'ساخت'}</Button>
          </form>
        )}
        {createError && <p className="text-sm text-danger">{createError}</p>}
        {status === 'loading' && <p className="text-sm text-muted">در حال بارگذاری گروه‌ها…</p>}
        {status === 'error' && (
          <div className="space-y-2">
            <Empty title="گروه‌ها از سامانه خوانده نشد" body={message} />
            <Button variant="secondary" className="w-full" onClick={refresh}>تلاش دوباره</Button>
          </div>
        )}
        {status === 'ready' && groups.length === 0 && <Empty title="گروهی نیست" body="گروه جدید بسازید." />}
        {status === 'ready' && groups.map((item) => {
          const count = counts[item.id]
          return (
            <button key={item.id} className={`min-h-11 w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => { setOpenId(item.id); setRename(item.name) }}>
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{count === undefined ? '—' : `${fa(count)} عضو`}</span>
            </button>
          )
        })}
      </div>
      {status === 'ready' && group && (
        <section className="rounded-md border border-line bg-surface p-4">
          {canEdit ? (
            <form className="flex flex-wrap gap-2" onSubmit={(event) => void saveName(event)}>
              <Field label="نام گروه">
                <input className={controlClass} value={rename} onChange={(event) => { setRename(event.target.value); setRenameError('') }} disabled={renameBusy} />
              </Field>
              <Button type="submit" className="self-end" disabled={renameBusy}>{renameBusy ? 'در حال ذخیره' : 'ذخیره نام'}</Button>
            </form>
          ) : (
            <h2 className="text-base font-semibold">{group.name}</h2>
          )}
          {renameError && <p className="mt-1 text-sm text-danger">{renameError}</p>}
          <p className="mt-3 text-xs text-muted">یک کارمند می‌تواند در چند گروه باشد. گروه‌ها از پیش تعیین‌شده نیستند.</p>
          {detailStatus === 'loading' && <p className="mt-3 text-sm text-muted">در حال خواندن اعضای گروه…</p>}
          {detailStatus === 'error' && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-danger">{detailMessage}</p>
              <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
            </div>
          )}
          {detailStatus === 'ready' && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {members.length === 0 && <li className="py-3 text-muted">عضوی در این گروه نیست.</li>}
              {members.map((employee) => (
                <li key={employee.membershipId} className="flex items-center justify-between py-2">
                  <span><span dir="ltr">{employee.username}</span> {!employee.isActive && <span className="text-xs text-muted">غیرفعال</span>}</span>
                  {canEdit && <Button variant="danger" onClick={() => { setRemoving(employee.userId); setRemoveError('') }}>حذف از گروه</Button>}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4" onSubmit={(event) => void addMember(event)}>
              <select className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-base" aria-label="افزودن کارمند به گروه" value={adding} onChange={(event) => setAdding(event.target.value)} disabled={addBusy}>
                <option value="">افزودن کارمند</option>
                {others.map((employee) => <option key={employee.id} value={employee.id}>{employee.username}</option>)}
              </select>
              <Button type="submit" disabled={!adding || addBusy}>{addBusy ? 'در حال افزودن' : 'افزودن'}</Button>
            </form>
          )}
          {addError && <p className="mt-2 text-sm text-danger">{addError}</p>}
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-medium">تاریخچه عضویت</p>
            {historyStatus === 'loading' && <p className="mt-2 text-sm text-muted">در حال خواندن تاریخچه…</p>}
            {historyStatus === 'error' && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-danger">{historyMessage}</p>
                <Button variant="secondary" onClick={refresh}>تلاش دوباره</Button>
              </div>
            )}
            {historyStatus === 'ready' && history.length === 0 && <p className="mt-2 text-sm text-muted">تاریخچه عضویت برای این گروه خالی است.</p>}
            {historyStatus === 'ready' && history.length > 0 && (
              <ul className="mt-2 divide-y divide-line text-sm">
                {history.map((row) => (
                  <li key={row.membershipId} className="py-2">
                    <span dir="ltr">{row.username}</span>
                    <span className="mt-1 block text-xs text-muted">از {formatGroupInstant(row.startedAt)} تا {formatGroupInstant(row.endedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canEdit && group.isActive && (
            <div className="mt-4 border-t border-line pt-4">
              <Button variant="danger" onClick={() => { setDeactivating(true); setDeactivateError('') }}>غیرفعال‌سازی گروه</Button>
            </div>
          )}
          {notice && <p className="mt-3 text-sm text-ok" role="status">{notice}</p>}
          <Dialog open={Boolean(removing)} title="حذف از گروه" onClose={() => !removeBusy && setRemoving('')}>
            <p className="text-sm">این کارمند از گروه «{group.name}» خارج شود؟ ساختمان و سفارش‌های او تغییر نمی‌کند.</p>
            {removeError && <p className="mt-2 text-sm text-danger">{removeError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" disabled={removeBusy} onClick={() => setRemoving('')}>انصراف</Button>
              <Button variant="danger" disabled={removeBusy} onClick={() => void confirmRemove()}>{removeBusy ? 'در حال حذف' : 'حذف از گروه'}</Button>
            </div>
          </Dialog>
          <Dialog open={deactivating} title="غیرفعال‌سازی گروه" onClose={() => !deactivateBusy && setDeactivating(false)}>
            <p className="text-sm">گروه «{group.name}» غیرفعال شود؟ عضویت‌های فعال بسته می‌شوند و گروه از فهرست فعال خارج می‌شود.</p>
            {deactivateError && <p className="mt-2 text-sm text-danger">{deactivateError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" disabled={deactivateBusy} onClick={() => setDeactivating(false)}>انصراف</Button>
              <Button variant="danger" disabled={deactivateBusy} onClick={() => void confirmDeactivate()}>{deactivateBusy ? 'در حال غیرفعال‌سازی' : 'غیرفعال‌سازی'}</Button>
            </div>
          </Dialog>
        </section>
      )}
    </div>
  )
}
