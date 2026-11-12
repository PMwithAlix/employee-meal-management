import { useState } from 'react'
import { Button, Dialog, Field, controlClass } from '../components/ui'
import { fullName } from '../data'
import { useApp } from '../store'
import { fa } from '../lib/text'

export function BuildingsPage() {
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
            <button key={item.id} className={`w-full rounded-md border px-3 py-2 text-start ${item.id === openId ? 'border-primary bg-surface' : 'border-line bg-surface'}`} onClick={() => setOpenId(item.id)}>
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
              <select className="h-10 min-w-[14rem] flex-1 rounded-md border border-line bg-bg px-2 text-sm" value={moving} onChange={(event) => setMoving(event.target.value)}>
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
      {editing && <BuildingForm id={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onCreated={setOpenId} />}
    </div>
  )
}

function BuildingForm({ id, onClose, onCreated }: { id?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const app = useApp()
  const current = app.buildings.find((item) => item.id === id)
  const [name, setName] = useState(current?.name ?? '')
  return (
    <Dialog open title={id ? 'ویرایش ساختمان' : 'ساختمان جدید'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          const nextId = app.saveBuilding(name, id)
          if (nextId && !id) onCreated(nextId)
          onClose()
        }}
      >
        <Field label="نام ساختمان"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <p className="mt-2 text-xs text-muted">در محدوده فعلی محصول، ساختمان فقط نام دارد.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
          <Button type="submit">ذخیره</Button>
        </div>
      </form>
    </Dialog>
  )
}
