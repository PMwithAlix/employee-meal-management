import { useState } from 'react'
import { Button, Field, controlClass } from '../components/ui'
import { fullName } from '../data'
import { useApp } from '../store'
import { fa } from '../lib/text'

export function GroupsPage() {
  const app = useApp()
  const [openId, setOpenId] = useState(app.groups[0]?.id ?? '')
  const [creating, setCreating] = useState('')
  const [rename, setRename] = useState('')
  const [adding, setAdding] = useState('')
  const group = app.groups.find((item) => item.id === openId)
  const members = app.employees.filter((employee) => employee.groupIds.includes(openId))
  const others = app.employees.filter((employee) => employee.active && !employee.groupIds.includes(openId))

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!creating.trim()) return
            app.saveGroup(creating)
            setCreating('')
          }}
        >
          <input value={creating} onChange={(event) => setCreating(event.target.value)} placeholder="گروه جدید" className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm" />
          <Button type="submit">ساخت</Button>
        </form>
        {app.groups.map((item) => {
          const count = app.employees.filter((employee) => employee.groupIds.includes(item.id)).length
          return (
            <button key={item.id} className={`w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => { setOpenId(item.id); setRename(item.name) }}>
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{fa(count)} عضو</span>
            </button>
          )
        })}
      </div>
      {group && (
        <section className="rounded-md border border-line bg-surface p-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              app.saveGroup(rename || group.name, group.id)
            }}
          >
            <Field label="نام گروه">
              <input className={controlClass} value={rename || group.name} onChange={(event) => setRename(event.target.value)} />
            </Field>
            <Button type="submit" className="self-end">ذخیره نام</Button>
          </form>
          <p className="mt-3 text-xs text-muted">یک کارمند می‌تواند در چند گروه باشد. گروه‌ها از پیش تعیین‌شده نیستند.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {members.length === 0 && <li className="py-3 text-muted">عضوی در این گروه نیست.</li>}
            {members.map((employee) => (
              <li key={employee.id} className="flex items-center justify-between py-2">
                <span>{fullName(employee)} {!employee.active && <span className="text-xs text-muted">غیرفعال</span>}</span>
                <button className="text-xs text-danger" onClick={() => app.setMembership(group.id, employee.id, false)}>حذف از گروه</button>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!adding) return
              app.setMembership(group.id, adding, true)
              setAdding('')
            }}
          >
            <select className="h-10 min-w-[14rem] flex-1 rounded-md border border-line bg-bg px-2 text-sm" value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">افزودن کارمند</option>
              {others.map((employee) => <option key={employee.id} value={employee.id}>{fullName(employee)}</option>)}
            </select>
            <Button type="submit" disabled={!adding}>افزودن</Button>
          </form>
        </section>
      )}
    </div>
  )
}
