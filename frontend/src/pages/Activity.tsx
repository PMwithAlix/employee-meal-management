import { useEffect, useState } from 'react'
import { Button, Empty } from '../shared/ui/primitives'
import { AuthRequestError } from '../features/auth/lib/auth-errors'
import { auditApi, type AuditLogItem } from '../features/audit/api/audit-api'
import { usesLiveOrganizationData } from '../shared/config/permissions'
import { useApp } from '../app/providers/app-store'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatJson(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

export function ActivityPage() {
  const app = useApp()
  if (usesLiveOrganizationData(app.role)) return <AuditActivityPage />
  return <SeedActivityPage />
}

function SeedActivityPage() {
  const app = useApp()
  const [q, setQ] = useState('')
  const rows = app.activity.filter((item) => {
    const blob = normalize(`${item.actor} ${item.action} ${item.target} ${item.before} ${item.after}`)
    const query = normalize(q)
    return !query || blob.includes(query)
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">سابقه عملیات فقط خواندنی است. این فهرست اعلان نیست.</p>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="جستجو در کاربر، عملیات، موضوع یا مقدار" aria-label="جستجوی تاریخچه" className="h-11 w-full rounded-md border border-line bg-surface px-3 text-base" />
      {rows.length === 0 ? <Empty title={q.trim() ? 'نتیجه‌ای برای این جستجو نیست' : 'رویدادی ثبت نشده'} body={q.trim() ? 'عبارت را کوتاه‌تر کنید یا فاصله‌های اضافه را بردارید.' : 'عملیات موفق اینجا دیده می‌شود. جابه‌جایی بین صفحه‌ها ثبت نمی‌شود.'} /> : <ActivityTable rows={rows.map((item) => ({ id: item.id, at: item.at, actor: item.actor, action: item.action, target: item.target, before: item.before, after: item.after, result: item.result }))} />}
    </div>
  )
}

function AuditActivityPage() {
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [boot, setBoot] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void auditApi.list({ page, pageSize, action: action.trim() || undefined, from: from || undefined, to: to || undefined }, controller.signal).then((listed) => {
      if (controller.signal.aborted) return
      if (!Number.isInteger(listed.total) || listed.page !== page || listed.pageSize !== pageSize) {
        setItems([])
        setStatus('error')
        setMessage('بارگذاری تاریخچه فعالیت کامل نشد.')
        return
      }
      setItems(listed.items)
      setTotal(listed.total)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setItems([])
      setStatus('error')
      setMessage(error instanceof AuthRequestError ? error.message : 'بارگذاری تاریخچه انجام نشد.')
    })
    return () => controller.abort()
  }, [page, pageSize, action, from, to, boot])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">سابقه عملیات فقط خواندنی است و از سامانه خوانده می‌شود.</p>
      <div className="grid gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-3">
        <label className="text-xs text-muted">نوع عملیات<input className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base" value={action} onChange={(event) => { setAction(event.target.value); setPage(1) }} /></label>
        <label className="text-xs text-muted">از تاریخ<input className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label>
        <label className="text-xs text-muted">تا تاریخ<input className="mt-1 h-11 w-full rounded-md border border-line bg-bg px-2 text-base" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label>
      </div>
      {status === 'loading' && <p className="text-sm text-muted">در حال بارگذاری تاریخچه…</p>}
      {status === 'error' && (
        <div className="space-y-2">
          <Empty title="تاریخچه از سامانه خوانده نشد" body={message} />
          <Button variant="secondary" onClick={() => setBoot((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && <Empty title="رویدادی ثبت نشده" body="با فیلترهای فعلی موردی از سامانه برنگشت." />}
      {status === 'ready' && items.length > 0 && (
        <>
          <ActivityTable rows={items.map((item) => ({
            id: item.id,
            at: item.createdAt,
            actor: item.actorUsername || '—',
            action: item.action,
            target: `${item.entityType} · ${item.entityId}`,
            before: formatJson(item.beforeData),
            after: formatJson(item.afterData),
            result: 'ثبت‌شده',
          }))} />
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
              <span>{page} / {pageCount}</span>
              <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActivityTable({ rows }: { rows: Array<{ id: string; at: string; actor: string; action: string; target: string; before: string; after: string; result: string }> }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-line bg-surface lg:block">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-xs text-muted">
            <tr>
              {['زمان', 'کاربر', 'عملیات', 'موضوع', 'مقدار قبلی', 'مقدار جدید', 'نتیجه'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-line align-top">
                <td className="px-3 py-2 whitespace-nowrap">{item.at}</td>
                <td className="px-3 py-2">{item.actor}</td>
                <td className="px-3 py-2">{item.action}</td>
                <td className="px-3 py-2 break-words">{item.target}</td>
                <td className="px-3 py-2 break-words">{item.before}</td>
                <td className="px-3 py-2 break-words">{item.after}</td>
                <td className="px-3 py-2">{item.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 lg:hidden">
        {rows.map((item) => (
          <article key={item.id} className="rounded-md border border-line bg-surface p-3 text-sm">
            <p className="font-medium">{item.action}</p>
            <p className="text-xs text-muted">{item.at} · {item.actor}</p>
            <p className="mt-2 break-words">{item.target}</p>
            <p className="break-words text-xs text-muted">قبلی: {item.before}</p>
            <p className="break-words text-xs text-muted">جدید: {item.after}</p>
            <p className="text-xs">نتیجه: {item.result}</p>
          </article>
        ))}
      </div>
    </>
  )
}
