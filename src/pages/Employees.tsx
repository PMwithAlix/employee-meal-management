import { useMemo, useState } from 'react'
import { Badge, Button, Dialog, Empty, Field, controlClass } from '../components/ui'
import { fullName } from '../data'
import { useApp } from '../store'

export function EmployeesPage() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [buildingId, setBuildingId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [selected, setSelected] = useState<string | null>(app.employees[0]?.id ?? null)
  const rows = useMemo(() => app.employees.filter((employee) => {
    const blob = `${fullName(employee)} ${employee.username}`
    if (q.trim() && !blob.includes(q.trim())) return false
    if (buildingId !== 'all' && employee.buildingId !== buildingId) return false
    if (groupId !== 'all' && !employee.groupIds.includes(groupId)) return false
    if (status === 'active' && !employee.active) return false
    if (status === 'inactive' && employee.active) return false
    return true
  }), [app.employees, q, buildingId, groupId, status])
  const current = app.employees.find((employee) => employee.id === selected)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="نام یا نام کاربری" className="h-10 min-w-[12rem] flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
          <select className="h-10 rounded-md border border-line bg-surface px-2 text-sm" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="all">همه ساختمان‌ها</option>
            {app.buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-surface px-2 text-sm" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="all">همه گروه‌ها</option>
            {app.groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="h-10 rounded-md border border-line bg-surface px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}>
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
          <Button onClick={() => setEditing('new')}>کارمند جدید</Button>
        </div>
        {rows.length === 0 ? <Empty title="کارمندی پیدا نشد" body="عبارت جستجو یا فیلتر را تغییر دهید." /> : (
          <div className="overflow-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface2 text-xs text-muted">
                <tr>
                  {['نام', 'نام کاربری', 'ساختمان', 'گروه‌ها', 'وضعیت', 'تاریخ ایجاد'].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((employee) => (
                  <tr key={employee.id} className="cursor-pointer border-t border-line hover:bg-surface2" onClick={() => setSelected(employee.id)}>
                    <td className="px-3 py-2">{fullName(employee)}</td>
                    <td className="px-3 py-2" dir="ltr">{employee.username}</td>
                    <td className="px-3 py-2">{app.buildings.find((item) => item.id === employee.buildingId)?.name}</td>
                    <td className="px-3 py-2">{employee.groupIds.map((id) => app.groups.find((item) => item.id === id)?.name).filter(Boolean).join('، ') || '—'}</td>
                    <td className="px-3 py-2"><Badge tone={employee.active ? 'ok' : 'neutral'}>{employee.active ? 'فعال' : 'غیرفعال'}</Badge></td>
                    <td className="px-3 py-2 text-muted">{employee.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {current && (
        <aside className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold">{fullName(current)}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="نام کاربری" value={current.username} ltr />
            <Row label="ساختمان" value={app.buildings.find((item) => item.id === current.buildingId)?.name ?? '—'} />
            <Row label="گروه‌ها" value={current.groupIds.map((id) => app.groups.find((item) => item.id === id)?.name).filter(Boolean).join('، ') || '—'} />
            <Row label="وضعیت" value={current.active ? 'فعال' : 'غیرفعال'} />
            <Row label="تاریخ ایجاد" value={current.created} />
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => setEditing(current.id)}>ویرایش</Button>
            <Button variant={current.active ? 'danger' : 'primary'} onClick={() => app.setEmployeeActive(current.id, !current.active)}>
              {current.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">حذف حساب انجام نمی‌شود. وضعیت حساب بین فعال و غیرفعال عوض می‌شود.</p>
        </aside>
      )}
      {editing && <EmployeeForm id={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  )
}

function EmployeeForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const app = useApp()
  const current = app.employees.find((employee) => employee.id === id)
  const [firstName, setFirstName] = useState(current?.firstName ?? '')
  const [lastName, setLastName] = useState(current?.lastName ?? '')
  const [username, setUsername] = useState(current?.username ?? '')
  const [password, setPassword] = useState('')
  const [buildingId, setBuildingId] = useState(current?.buildingId ?? app.buildings[0]?.id ?? '')
  const [groupIds, setGroupIds] = useState<string[]>(current?.groupIds ?? [])
  const [error, setError] = useState('')

  return (
    <Dialog open title={id ? 'ویرایش کارمند' : 'کارمند جدید'} onClose={onClose} wide>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!id && password.trim().length < 4) {
            setError('رمز عبور را وارد کنید.')
            return
          }
          const message = app.saveEmployee({ id, firstName, lastName, username, buildingId, groupIds })
          if (message) setError(message)
          else onClose()
        }}
      >
        <Field label="نام"><input className={controlClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
        <Field label="نام خانوادگی"><input className={controlClass} value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
        <Field label="نام کاربری"><input className={controlClass} dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
        {!id && <Field label="رمز عبور"><input className={controlClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>}
        <Field label="ساختمان">
          <select className={controlClass} value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            {app.buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm text-muted">گروه‌های کارکنان</legend>
          <div className="flex flex-wrap gap-2">
            {app.groups.map((group) => (
              <label key={group.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={groupIds.includes(group.id)}
                  onChange={(event) => setGroupIds((list) => event.target.checked ? [...list, group.id] : list.filter((item) => item !== group.id))}
                />
                {group.name}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button type="submit">ذخیره</Button>
        </div>
      </form>
    </Dialog>
  )
}
